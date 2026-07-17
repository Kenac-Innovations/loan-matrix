# USSD Admin PIN Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Loan Matrix screen where authorized staff can find a USSD client by phone number and trigger a staff-assisted USSD PIN reset that is logged in Loan Matrix.

**Architecture:** USSD remains the owner of USSD user lookup, PIN generation, PIN hashing, and SMS delivery. Loan Matrix owns staff authorization, UI workflow, and local reset audit records. Loan Matrix calls a new USSD admin API using a dedicated API key and never receives or stores the new PIN.

**Tech Stack:** Loan Matrix: Next.js App Router, React, Prisma, NextAuth session data, `node --import tsx --test`. USSD: Java 17, Spring Boot, Spring MVC, Spring Data JPA, Mockito/JUnit 5.

## Global Constraints

- The reset type is "generated new PIN": USSD generates a new 4-digit PIN and sends it by SMS; no forced PIN change on next login is included.
- SMS sending remains inside the USSD service.
- The admin-reset SMS must clearly differ from self-service reset messages and must say the PIN was reset by Goodfellow staff.
- Loan Matrix must never receive, display, log, or persist the new PIN.
- Loan Matrix must log every reset attempt with tenant, requested phone number, matched USSD user details, actor, reason, status, and error details.
- USSD admin endpoints must require `X-USSD-Admin-Key` and read the expected value from `USSD_ADMIN_API_KEY`.
- Do not reuse `USSD_LOAN_PRODUCT_SYNC_API_KEY` for PIN reset.
- Existing USSD self-service PIN reset behavior must remain unchanged.
- Existing `USSD_BASE_URL` is reused by Loan Matrix; add `USSD_ADMIN_API_KEY` to Loan Matrix runtime configuration.

---

## File Map

### USSD Repo: `/home/parten/Documents/kenac dev/USSD/GoodFellowUssd`

- Create: `src/main/java/zw/co/kenac/goodfellow_ussd_app/dto/admin/AdminUserLookupResponse.java`
- Create: `src/main/java/zw/co/kenac/goodfellow_ussd_app/dto/admin/AdminPinResetRequest.java`
- Create: `src/main/java/zw/co/kenac/goodfellow_ussd_app/dto/admin/AdminPinResetResponse.java`
- Create: `src/main/java/zw/co/kenac/goodfellow_ussd_app/service/AdminPinResetService.java`
- Create: `src/main/java/zw/co/kenac/goodfellow_ussd_app/controller/AdminPinResetController.java`
- Modify: `src/main/java/zw/co/kenac/goodfellow_ussd_app/util/SmsTemplates.java`
- Test: `src/test/java/zw/co/kenac/goodfellow_ussd_app/service/AdminPinResetServiceTest.java`
- Test: `src/test/java/zw/co/kenac/goodfellow_ussd_app/controller/AdminPinResetControllerTest.java`

### Loan Matrix Repo: `/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix`

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260713090000_add_ussd_admin_pin_reset/migration.sql`
- Modify: `env.example`
- Create: `lib/ussd-admin-client.ts`
- Create: `lib/ussd-pin-reset-access.ts`
- Create: `app/api/ussd-pin-reset/lookup/route.ts`
- Create: `app/api/ussd-pin-reset/reset/route.ts`
- Create: `app/api/ussd-pin-reset/logs/route.ts`
- Create: `app/(application)/ussd-pin-reset/page.tsx`
- Create: `app/(application)/ussd-pin-reset/components/ussd-pin-reset-client.tsx`
- Modify: `app/(application)/components/sidebar-nav.tsx`
- Modify: `app/(application)/components/mobile-sidebar.tsx`
- Modify: `app/api/auth/user-roles/route.ts`
- Modify: `components/role-guard.tsx`
- Modify: `lib/user-login-service.ts`
- Modify: `shared/types/user-management.ts`
- Modify: `app/actions/user-management-actions.ts`
- Modify: `app/(application)/organization/users/components/user-form.tsx`
- Modify: `app/(application)/organization/users/components/users-page-client.tsx`
- Modify: `app/(application)/organization/users/components/user-detail-tabs.tsx`
- Test: `lib/__tests__/ussd-admin-pin-reset.test.ts`

---

### Task 1: Add USSD Admin Reset Service And SMS Template

**Files:**
- Create: `src/main/java/zw/co/kenac/goodfellow_ussd_app/dto/admin/AdminUserLookupResponse.java`
- Create: `src/main/java/zw/co/kenac/goodfellow_ussd_app/dto/admin/AdminPinResetRequest.java`
- Create: `src/main/java/zw/co/kenac/goodfellow_ussd_app/dto/admin/AdminPinResetResponse.java`
- Create: `src/main/java/zw/co/kenac/goodfellow_ussd_app/service/AdminPinResetService.java`
- Modify: `src/main/java/zw/co/kenac/goodfellow_ussd_app/util/SmsTemplates.java`
- Test: `src/test/java/zw/co/kenac/goodfellow_ussd_app/service/AdminPinResetServiceTest.java`

**Interfaces:**
- Consumes: `GoodfellowUserRepository.findActiveUserByAnyPhoneNumber(String phoneNumber)`, `GoodfellowUserService.updateUserPin(String phoneNumber, String newPin)`, `SmsNotificationService.sendSms(List<String> phoneNumbers, String message)`.
- Produces:
  - `Optional<AdminUserLookupResponse> lookupByPhoneNumber(String phoneNumber)`
  - `AdminPinResetResponse resetPin(AdminPinResetRequest request)`
  - `String normalizePhoneNumber(String phoneNumber)`
  - `SmsTemplates.adminPinResetMessage(String customerName, String newPin, String organizationName)`

- [ ] **Step 1: Write the failing service test**

Create `src/test/java/zw/co/kenac/goodfellow_ussd_app/service/AdminPinResetServiceTest.java` with these tests:

```java
package zw.co.kenac.goodfellow_ussd_app.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import zw.co.kenac.goodfellow_ussd_app.dto.admin.AdminPinResetRequest;
import zw.co.kenac.goodfellow_ussd_app.model.entity.GoodfellowUser;
import zw.co.kenac.goodfellow_ussd_app.model.enums.UserStatus;
import zw.co.kenac.goodfellow_ussd_app.repository.GoodfellowUserRepository;
import zw.co.kenac.goodfellow_ussd_app.dto.sms.SmsNotificationResponse;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminPinResetServiceTest {

    @Mock private GoodfellowUserRepository userRepository;
    @Mock private GoodfellowUserService goodfellowUserService;
    @Mock private SmsNotificationService smsNotificationService;

    private AdminPinResetService service;

    @BeforeEach
    void setUp() {
        service = new AdminPinResetService(userRepository, goodfellowUserService, smsNotificationService);
    }

    @Test
    void normalizePhoneNumber_convertsZambianLocalNumberTo260Format() {
        assertEquals("260977123456", service.normalizePhoneNumber("0977 123 456"));
        assertEquals("260977123456", service.normalizePhoneNumber("+260 977 123 456"));
        assertEquals("260977123456", service.normalizePhoneNumber("977123456"));
    }

    @Test
    void lookupByPhoneNumber_returnsSafeClientDetailsWithoutPin() {
        GoodfellowUser user = GoodfellowUser.builder()
                .id(42L)
                .fullName("Mary Banda")
                .nationalId("123456/78/9")
                .phoneNumber("260977123456")
                .accountNumber("ACC-123")
                .status(UserStatus.ACTIVE)
                .externalId(9911L)
                .build();
        when(userRepository.findActiveUserByAnyPhoneNumber("260977123456")).thenReturn(Optional.of(user));

        var result = service.lookupByPhoneNumber("0977123456");

        assertTrue(result.isPresent());
        assertEquals("42", result.get().getUserId());
        assertEquals("Mary Banda", result.get().getFullName());
        assertEquals("260977123456", result.get().getPhoneNumber());
        assertEquals("123456****", result.get().getNationalIdMask());
    }

    @Test
    void resetPin_generatesNewPinUpdatesUserAndSendsAdminResetSms() {
        GoodfellowUser user = GoodfellowUser.builder()
                .id(42L)
                .fullName("Mary Banda")
                .nationalId("123456/78/9")
                .phoneNumber("260977123456")
                .accountNumber("ACC-123")
                .status(UserStatus.ACTIVE)
                .build();
        when(userRepository.findActiveUserByAnyPhoneNumber("260977123456")).thenReturn(Optional.of(user));
        when(goodfellowUserService.updateUserPin(eq("260977123456"), anyString())).thenReturn(true);
        when(smsNotificationService.sendSms(anyList(), anyString())).thenReturn(
                SmsNotificationResponse.builder().success(true).message("accepted").build()
        );

        var response = service.resetPin(AdminPinResetRequest.builder()
                .phoneNumber("0977123456")
                .actorUserId("501")
                .actorName("Admin User")
                .reason("Client verified at branch")
                .build());

        assertTrue(response.isSuccess());
        assertEquals("SUCCESS", response.getStatus());
        assertEquals("42", response.getUserId());
        assertNull(response.getNewPin());

        ArgumentCaptor<String> pinCaptor = ArgumentCaptor.forClass(String.class);
        verify(goodfellowUserService).updateUserPin(eq("260977123456"), pinCaptor.capture());
        assertTrue(pinCaptor.getValue().matches("^\\d{4}$"));

        ArgumentCaptor<String> smsCaptor = ArgumentCaptor.forClass(String.class);
        verify(smsNotificationService).sendSms(eq(java.util.List.of("260977123456")), smsCaptor.capture());
        assertTrue(smsCaptor.getValue().contains("reset by Goodfellow staff"));
        assertTrue(smsCaptor.getValue().contains(pinCaptor.getValue()));
    }

    @Test
    void resetPin_returnsNotFoundWhenPhoneDoesNotMatchActiveUser() {
        when(userRepository.findActiveUserByAnyPhoneNumber("260977123456")).thenReturn(Optional.empty());

        var response = service.resetPin(AdminPinResetRequest.builder()
                .phoneNumber("0977123456")
                .actorUserId("501")
                .actorName("Admin User")
                .reason("Client verified at branch")
                .build());

        assertFalse(response.isSuccess());
        assertEquals("NOT_FOUND", response.getStatus());
        verifyNoInteractions(goodfellowUserService, smsNotificationService);
    }
}
```

- [ ] **Step 2: Run the service test to verify it fails**

Run:

```bash
cd "/home/parten/Documents/kenac dev/USSD/GoodFellowUssd"
./mvnw -Dtest=AdminPinResetServiceTest test
```

Expected: compilation fails because the admin DTOs, service, and SMS template do not exist.

- [ ] **Step 3: Create the admin DTOs**

Create `src/main/java/zw/co/kenac/goodfellow_ussd_app/dto/admin/AdminUserLookupResponse.java`:

```java
package zw.co.kenac.goodfellow_ussd_app.dto.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminUserLookupResponse {
    private String userId;
    private String fullName;
    private String nationalIdMask;
    private String phoneNumber;
    private String accountNumber;
    private String status;
    private Long externalId;
    private LocalDateTime createdAt;
}
```

Create `src/main/java/zw/co/kenac/goodfellow_ussd_app/dto/admin/AdminPinResetRequest.java`:

```java
package zw.co.kenac.goodfellow_ussd_app.dto.admin;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminPinResetRequest {
    @NotBlank(message = "phoneNumber is required")
    private String phoneNumber;

    @NotBlank(message = "actorUserId is required")
    private String actorUserId;

    @NotBlank(message = "actorName is required")
    private String actorName;

    @NotBlank(message = "reason is required")
    private String reason;
}
```

Create `src/main/java/zw/co/kenac/goodfellow_ussd_app/dto/admin/AdminPinResetResponse.java`:

```java
package zw.co.kenac.goodfellow_ussd_app.dto.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminPinResetResponse {
    private boolean success;
    private String status;
    private String message;
    private String userId;
    private String fullName;
    private String phoneNumber;
    private String accountNumber;
    private String nationalIdMask;
    private Boolean pinChanged;
    private Boolean smsAccepted;

    /**
     * Always null by design. The new PIN is only sent to the client by SMS.
     */
    private String newPin;
}
```

- [ ] **Step 4: Add the admin SMS template**

In `src/main/java/zw/co/kenac/goodfellow_ussd_app/util/SmsTemplates.java`, add:

```java
public static String adminPinResetMessage(String customerName, String newPin, String organizationName) {
    String safeCustomerName = customerName == null || customerName.isBlank() ? "Customer" : customerName.trim();
    String safeOrganizationName = organizationName == null || organizationName.isBlank()
            ? "Goodfellow Finance Ltd"
            : organizationName.trim();

    return "Dear " + safeCustomerName
            + ", your Goodfellow USSD PIN was reset by Goodfellow staff. "
            + "Your new PIN is " + newPin + ". "
            + "If you did not request this reset, contact " + safeOrganizationName + " immediately.";
}
```

- [ ] **Step 5: Create the service implementation**

Create `src/main/java/zw/co/kenac/goodfellow_ussd_app/service/AdminPinResetService.java`:

```java
package zw.co.kenac.goodfellow_ussd_app.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import zw.co.kenac.goodfellow_ussd_app.dto.admin.AdminPinResetRequest;
import zw.co.kenac.goodfellow_ussd_app.dto.admin.AdminPinResetResponse;
import zw.co.kenac.goodfellow_ussd_app.dto.admin.AdminUserLookupResponse;
import zw.co.kenac.goodfellow_ussd_app.dto.sms.SmsNotificationResponse;
import zw.co.kenac.goodfellow_ussd_app.model.entity.GoodfellowUser;
import zw.co.kenac.goodfellow_ussd_app.repository.GoodfellowUserRepository;
import zw.co.kenac.goodfellow_ussd_app.util.SmsTemplates;

import java.security.SecureRandom;
import java.util.List;
import java.util.Optional;

@Service
@Slf4j
@RequiredArgsConstructor
public class AdminPinResetService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final GoodfellowUserRepository userRepository;
    private final GoodfellowUserService goodfellowUserService;
    private final SmsNotificationService smsNotificationService;

    public Optional<AdminUserLookupResponse> lookupByPhoneNumber(String phoneNumber) {
        String normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
        if (normalizedPhoneNumber.isBlank()) {
            return Optional.empty();
        }

        return userRepository.findActiveUserByAnyPhoneNumber(normalizedPhoneNumber)
                .map(this::toLookupResponse);
    }

    @Transactional
    public AdminPinResetResponse resetPin(AdminPinResetRequest request) {
        String normalizedPhoneNumber = normalizePhoneNumber(request.getPhoneNumber());
        if (normalizedPhoneNumber.isBlank()) {
            return failure("INVALID_PHONE", "A valid phone number is required", null, false, false);
        }

        Optional<GoodfellowUser> userOpt = userRepository.findActiveUserByAnyPhoneNumber(normalizedPhoneNumber);
        if (userOpt.isEmpty()) {
            return failure("NOT_FOUND", "No active USSD user was found for this phone number", null, false, false);
        }

        GoodfellowUser user = userOpt.get();
        String newPin = generateFourDigitPin();
        boolean pinChanged = goodfellowUserService.updateUserPin(normalizedPhoneNumber, newPin);
        if (!pinChanged) {
            return failure("PIN_UPDATE_FAILED", "The USSD PIN could not be updated", user, false, false);
        }

        String message = SmsTemplates.adminPinResetMessage(
                user.getFullName(),
                newPin,
                "Goodfellow Finance Ltd"
        );
        SmsNotificationResponse smsResponse = smsNotificationService.sendSms(
                List.of(normalizedPhoneNumber),
                message
        );
        boolean smsAccepted = smsResponse != null && smsResponse.isSuccess();

        log.info("Admin PIN reset requested by actorUserId={} actorName={} for ussdUserId={} phone={} reason={}",
                request.getActorUserId(), request.getActorName(), user.getId(), normalizedPhoneNumber, request.getReason());

        if (!smsAccepted) {
            return failure("SMS_FAILED_PIN_CHANGED", "PIN was changed but the reset SMS was not accepted", user, true, false);
        }

        return AdminPinResetResponse.builder()
                .success(true)
                .status("SUCCESS")
                .message("PIN reset SMS sent")
                .userId(String.valueOf(user.getId()))
                .fullName(user.getFullName())
                .phoneNumber(normalizedPhoneNumber)
                .accountNumber(user.getAccountNumber())
                .nationalIdMask(maskNationalId(user.getNationalId()))
                .pinChanged(true)
                .smsAccepted(true)
                .newPin(null)
                .build();
    }

    public String normalizePhoneNumber(String phoneNumber) {
        if (phoneNumber == null) {
            return "";
        }

        String digits = phoneNumber.replaceAll("[^0-9]", "");
        if (digits.isBlank()) {
            return "";
        }
        if (digits.startsWith("260")) {
            return digits;
        }
        if (digits.startsWith("0") && digits.length() >= 10) {
            return "260" + digits.substring(1);
        }
        if (digits.length() == 9) {
            return "260" + digits;
        }
        return digits;
    }

    private AdminUserLookupResponse toLookupResponse(GoodfellowUser user) {
        return AdminUserLookupResponse.builder()
                .userId(String.valueOf(user.getId()))
                .fullName(user.getFullName())
                .nationalIdMask(maskNationalId(user.getNationalId()))
                .phoneNumber(user.getPhoneNumber())
                .accountNumber(user.getAccountNumber())
                .status(user.getStatus() == null ? null : user.getStatus().name())
                .externalId(user.getExternalId())
                .createdAt(user.getCreatedAt())
                .build();
    }

    private AdminPinResetResponse failure(
            String status,
            String message,
            GoodfellowUser user,
            boolean pinChanged,
            boolean smsAccepted
    ) {
        return AdminPinResetResponse.builder()
                .success(false)
                .status(status)
                .message(message)
                .userId(user == null ? null : String.valueOf(user.getId()))
                .fullName(user == null ? null : user.getFullName())
                .phoneNumber(user == null ? null : user.getPhoneNumber())
                .accountNumber(user == null ? null : user.getAccountNumber())
                .nationalIdMask(user == null ? null : maskNationalId(user.getNationalId()))
                .pinChanged(pinChanged)
                .smsAccepted(smsAccepted)
                .newPin(null)
                .build();
    }

    private String generateFourDigitPin() {
        return String.valueOf(1000 + SECURE_RANDOM.nextInt(9000));
    }

    private String maskNationalId(String nationalId) {
        if (nationalId == null || nationalId.isBlank()) {
            return null;
        }

        String trimmed = nationalId.trim();
        int visibleLength = Math.min(6, trimmed.length());
        return trimmed.substring(0, visibleLength) + "****";
    }
}
```

- [ ] **Step 6: Run the service test to verify it passes**

Run:

```bash
./mvnw -Dtest=AdminPinResetServiceTest test
```

Expected: all tests in `AdminPinResetServiceTest` pass.

- [ ] **Step 7: Commit the USSD service change**

```bash
git add src/main/java/zw/co/kenac/goodfellow_ussd_app/dto/admin \
        src/main/java/zw/co/kenac/goodfellow_ussd_app/service/AdminPinResetService.java \
        src/main/java/zw/co/kenac/goodfellow_ussd_app/util/SmsTemplates.java \
        src/test/java/zw/co/kenac/goodfellow_ussd_app/service/AdminPinResetServiceTest.java
git commit -m "feat: add USSD admin PIN reset service"
```

---

### Task 2: Add USSD Admin Controller Protected By API Key

**Files:**
- Create: `src/main/java/zw/co/kenac/goodfellow_ussd_app/controller/AdminPinResetController.java`
- Test: `src/test/java/zw/co/kenac/goodfellow_ussd_app/controller/AdminPinResetControllerTest.java`

**Interfaces:**
- Consumes: `AdminPinResetService.lookupByPhoneNumber(String)`, `AdminPinResetService.resetPin(AdminPinResetRequest)`.
- Produces:
  - `GET /api/v1/admin/users/lookup?phoneNumber=...`
  - `POST /api/v1/admin/users/pin-reset`
  - Header: `X-USSD-Admin-Key`

- [ ] **Step 1: Write the failing controller test**

Create `src/test/java/zw/co/kenac/goodfellow_ussd_app/controller/AdminPinResetControllerTest.java`:

```java
package zw.co.kenac.goodfellow_ussd_app.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import zw.co.kenac.goodfellow_ussd_app.dto.admin.AdminPinResetResponse;
import zw.co.kenac.goodfellow_ussd_app.dto.admin.AdminUserLookupResponse;
import zw.co.kenac.goodfellow_ussd_app.service.AdminPinResetService;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AdminPinResetController.class)
@TestPropertySource(properties = "USSD_ADMIN_API_KEY=test-admin-key")
class AdminPinResetControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean private AdminPinResetService adminPinResetService;

    @Test
    void lookupRejectsMissingApiKey() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users/lookup").param("phoneNumber", "0977123456"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Unauthorized admin request"));
    }

    @Test
    void lookupReturnsClientDetailsWhenApiKeyMatches() throws Exception {
        when(adminPinResetService.lookupByPhoneNumber("0977123456")).thenReturn(Optional.of(
                AdminUserLookupResponse.builder()
                        .userId("42")
                        .fullName("Mary Banda")
                        .nationalIdMask("123456****")
                        .phoneNumber("260977123456")
                        .accountNumber("ACC-123")
                        .status("ACTIVE")
                        .build()
        ));

        mockMvc.perform(get("/api/v1/admin/users/lookup")
                        .header("X-USSD-Admin-Key", "test-admin-key")
                        .param("phoneNumber", "0977123456"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value("42"))
                .andExpect(jsonPath("$.fullName").value("Mary Banda"))
                .andExpect(jsonPath("$.nationalIdMask").value("123456****"));
    }

    @Test
    void resetReturnsServiceResponseWithoutNewPin() throws Exception {
        when(adminPinResetService.resetPin(any())).thenReturn(AdminPinResetResponse.builder()
                .success(true)
                .status("SUCCESS")
                .message("PIN reset SMS sent")
                .userId("42")
                .fullName("Mary Banda")
                .phoneNumber("260977123456")
                .pinChanged(true)
                .smsAccepted(true)
                .newPin(null)
                .build());

        mockMvc.perform(post("/api/v1/admin/users/pin-reset")
                        .header("X-USSD-Admin-Key", "test-admin-key")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(java.util.Map.of(
                                "phoneNumber", "0977123456",
                                "actorUserId", "501",
                                "actorName", "Admin User",
                                "reason", "Client verified at branch"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.newPin").doesNotExist());
    }
}
```

- [ ] **Step 2: Run the controller test to verify it fails**

Run:

```bash
cd "/home/parten/Documents/kenac dev/USSD/GoodFellowUssd"
./mvnw -Dtest=AdminPinResetControllerTest test
```

Expected: compilation fails because `AdminPinResetController` does not exist.

- [ ] **Step 3: Create the controller**

Create `src/main/java/zw/co/kenac/goodfellow_ussd_app/controller/AdminPinResetController.java`:

```java
package zw.co.kenac.goodfellow_ussd_app.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import zw.co.kenac.goodfellow_ussd_app.dto.admin.AdminPinResetRequest;
import zw.co.kenac.goodfellow_ussd_app.service.AdminPinResetService;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
@Validated
public class AdminPinResetController {

    private final AdminPinResetService adminPinResetService;

    @Value("${USSD_ADMIN_API_KEY:}")
    private String adminApiKey;

    @GetMapping("/lookup")
    public ResponseEntity<?> lookupUser(
            @RequestHeader(value = "X-USSD-Admin-Key", required = false) String providedApiKey,
            @RequestParam @NotBlank String phoneNumber
    ) {
        ResponseEntity<?> unauthorized = rejectUnauthorized(providedApiKey);
        if (unauthorized != null) {
            return unauthorized;
        }

        return adminPinResetService.lookupByPhoneNumber(phoneNumber)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "USSD user not found")));
    }

    @PostMapping("/pin-reset")
    public ResponseEntity<?> resetPin(
            @RequestHeader(value = "X-USSD-Admin-Key", required = false) String providedApiKey,
            @Valid @RequestBody AdminPinResetRequest request
    ) {
        ResponseEntity<?> unauthorized = rejectUnauthorized(providedApiKey);
        if (unauthorized != null) {
            return unauthorized;
        }

        var response = adminPinResetService.resetPin(request);
        HttpStatus status = response.isSuccess() ? HttpStatus.OK : HttpStatus.BAD_REQUEST;
        if ("NOT_FOUND".equals(response.getStatus())) {
            status = HttpStatus.NOT_FOUND;
        }
        if ("INVALID_PHONE".equals(response.getStatus())) {
            status = HttpStatus.BAD_REQUEST;
        }

        return ResponseEntity.status(status).body(response);
    }

    private ResponseEntity<?> rejectUnauthorized(String providedApiKey) {
        if (adminApiKey == null || adminApiKey.isBlank()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "USSD admin PIN reset API is not configured"));
        }

        if (providedApiKey == null || !adminApiKey.equals(providedApiKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Unauthorized admin request"));
        }

        return null;
    }
}
```

- [ ] **Step 4: Run the controller test to verify it passes**

Run:

```bash
./mvnw -Dtest=AdminPinResetControllerTest test
```

Expected: all controller tests pass.

- [ ] **Step 5: Run the focused USSD test set**

Run:

```bash
./mvnw -Dtest=AdminPinResetServiceTest,AdminPinResetControllerTest test
```

Expected: all tests pass.

- [ ] **Step 6: Commit the USSD controller change**

```bash
git add src/main/java/zw/co/kenac/goodfellow_ussd_app/controller/AdminPinResetController.java \
        src/test/java/zw/co/kenac/goodfellow_ussd_app/controller/AdminPinResetControllerTest.java
git commit -m "feat: expose secured USSD admin PIN reset API"
```

---

### Task 3: Add Loan Matrix Schema For Reset Access And Logs

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260713090000_add_ussd_admin_pin_reset/migration.sql`
- Test: `lib/__tests__/ussd-admin-pin-reset.test.ts`

**Interfaces:**
- Produces Prisma model `UssdPinResetLog`.
- Produces `UserLogin.canResetUssdPin`.
- Later tasks use `prisma.ussdPinResetLog`.

- [ ] **Step 1: Write the failing schema test**

Create `lib/__tests__/ussd-admin-pin-reset.test.ts`:

```ts
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readMigration(name: string): string {
  const migrationPath = path.join(repoRoot, "prisma/migrations", name, "migration.sql");
  assert.equal(existsSync(migrationPath), true, `${name} migration should exist`);
  return readFileSync(migrationPath, "utf8");
}

test("USSD admin PIN reset schema includes access flag and audit log", () => {
  const schema = readRepoFile("prisma/schema.prisma");
  const migration = readMigration("20260713090000_add_ussd_admin_pin_reset");

  assert.match(schema, /canResetUssdPin\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /model UssdPinResetLog/);
  assert.match(schema, /normalizedPhoneNumber\s+String/);
  assert.match(schema, /actorUserId\s+Int\?/);
  assert.match(schema, /reason\s+String/);
  assert.match(schema, /metadata\s+Json\?/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "UssdPinResetLog"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "canResetUssdPin" BOOLEAN NOT NULL DEFAULT false/);
});
```

- [ ] **Step 2: Run the schema test to verify it fails**

Run:

```bash
cd "/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix"
node --import tsx --test lib/__tests__/ussd-admin-pin-reset.test.ts
```

Expected: the test fails because the Prisma model and migration do not exist.

- [ ] **Step 3: Update `prisma/schema.prisma`**

In `model Tenant`, add:

```prisma
  ussdPinResetLogs     UssdPinResetLog[]
```

In `model UserLogin`, add near the existing operational access booleans:

```prisma
  canResetUssdPin   Boolean              @default(false)
```

Add this model after `model UssdLoanApplication`:

```prisma
model UssdPinResetLog {
  id                    String   @id @default(cuid())
  tenantId              String
  requestedPhoneNumber  String
  normalizedPhoneNumber String
  ussdUserId            String?
  clientFullName        String?
  clientNationalIdMask  String?
  accountNumber         String?
  status                String
  reason                String
  errorMessage          String?
  actorUserId           Int?
  actorName             String?
  metadata              Json?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  tenant                Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, normalizedPhoneNumber, createdAt])
  @@index([tenantId, actorUserId, createdAt])
  @@index([tenantId, status, createdAt])
}
```

- [ ] **Step 4: Add the migration SQL**

Create `prisma/migrations/20260713090000_add_ussd_admin_pin_reset/migration.sql`:

```sql
ALTER TABLE "UserLogin"
ADD COLUMN IF NOT EXISTS "canResetUssdPin" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "UssdPinResetLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "requestedPhoneNumber" TEXT NOT NULL,
  "normalizedPhoneNumber" TEXT NOT NULL,
  "ussdUserId" TEXT,
  "clientFullName" TEXT,
  "clientNationalIdMask" TEXT,
  "accountNumber" TEXT,
  "status" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "errorMessage" TEXT,
  "actorUserId" INTEGER,
  "actorName" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UssdPinResetLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UssdPinResetLog_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UssdPinResetLog_tenantId_normalizedPhoneNumber_createdAt_idx"
ON "UssdPinResetLog"("tenantId", "normalizedPhoneNumber", "createdAt");

CREATE INDEX IF NOT EXISTS "UssdPinResetLog_tenantId_actorUserId_createdAt_idx"
ON "UssdPinResetLog"("tenantId", "actorUserId", "createdAt");

CREATE INDEX IF NOT EXISTS "UssdPinResetLog_tenantId_status_createdAt_idx"
ON "UssdPinResetLog"("tenantId", "status", "createdAt");
```

- [ ] **Step 5: Run Prisma generate**

Run:

```bash
npx prisma generate
```

Expected: Prisma client is regenerated under `app/generated/prisma`.

- [ ] **Step 6: Run the schema test to verify it passes**

Run:

```bash
node --import tsx --test lib/__tests__/ussd-admin-pin-reset.test.ts
```

Expected: the schema test passes.

- [ ] **Step 7: Commit the schema change**

```bash
git add prisma/schema.prisma \
        prisma/migrations/20260713090000_add_ussd_admin_pin_reset/migration.sql \
        app/generated/prisma \
        lib/__tests__/ussd-admin-pin-reset.test.ts
git commit -m "feat: add USSD PIN reset audit schema"
```

---

### Task 4: Add Loan Matrix Reset Permission Plumbing

**Files:**
- Modify: `lib/user-login-service.ts`
- Modify: `shared/types/user-management.ts`
- Modify: `app/actions/user-management-actions.ts`
- Modify: `app/(application)/organization/users/components/user-form.tsx`
- Modify: `app/(application)/organization/users/components/users-page-client.tsx`
- Modify: `app/(application)/organization/users/components/user-detail-tabs.tsx`
- Modify: `app/api/auth/user-roles/route.ts`
- Modify: `components/role-guard.tsx`
- Modify: `lib/__tests__/ussd-admin-pin-reset.test.ts`

**Interfaces:**
- Produces `UserLogin.canResetUssdPin` in create/update user workflows.
- Produces `canResetUssdPin` in `/api/auth/user-roles`.
- Produces `useUserRoles().canResetUssdPin`.

- [ ] **Step 1: Extend the existing test**

Append this test to `lib/__tests__/ussd-admin-pin-reset.test.ts`:

```ts
test("USSD admin PIN reset access is exposed through user management and role helpers", () => {
  const actionsSource = readRepoFile("app/actions/user-management-actions.ts");
  const userTypesSource = readRepoFile("shared/types/user-management.ts");
  const userFormSource = readRepoFile(
    "app/(application)/organization/users/components/user-form.tsx"
  );
  const usersPageSource = readRepoFile(
    "app/(application)/organization/users/components/users-page-client.tsx"
  );
  const userDetailTabsSource = readRepoFile(
    "app/(application)/organization/users/components/user-detail-tabs.tsx"
  );
  const userLoginServiceSource = readRepoFile("lib/user-login-service.ts");
  const roleRouteSource = readRepoFile("app/api/auth/user-roles/route.ts");
  const roleGuardSource = readRepoFile("components/role-guard.tsx");

  assert.match(actionsSource, /canResetUssdPin: z\.boolean\(\)\.default\(false\)/);
  assert.match(actionsSource, /canResetUssdPin:\s+localLogin\?\.canResetUssdPin \?\? false/);
  assert.match(userTypesSource, /canResetUssdPin: boolean/);
  assert.match(userFormSource, /canResetUssdPin/);
  assert.match(userFormSource, /Can reset USSD PIN/);
  assert.match(usersPageSource, /canResetUssdPin/);
  assert.match(userDetailTabsSource, /Can Reset USSD PIN/);
  assert.match(userLoginServiceSource, /canResetUssdPin\?: boolean/);
  assert.match(userLoginServiceSource, /updateData\.canResetUssdPin/);
  assert.match(roleRouteSource, /canResetUssdPin/);
  assert.match(roleGuardSource, /canResetUssdPin/);
});
```

- [ ] **Step 2: Run the permission test to verify it fails**

Run:

```bash
node --import tsx --test lib/__tests__/ussd-admin-pin-reset.test.ts
```

Expected: the new test fails because the reset flag is not wired into user management.

- [ ] **Step 3: Update shared user-management types**

In `shared/types/user-management.ts`, add `canResetUssdPin` beside `canConfirmPayments`:

```ts
export interface UserSummary {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  displayName: string;
  email?: string;
  phone?: string;
  countryCode?: string;
  isBlocked: boolean;
  blockedAt?: string | null;
  canConfirmPayments: boolean;
  canResetUssdPin: boolean;
  officeId?: number;
  officeName?: string;
  roles: string[];
}
```

In `UserFormInput`, add:

```ts
  canResetUssdPin?: boolean;
```

- [ ] **Step 4: Update `lib/user-login-service.ts`**

Add `canResetUssdPin?: boolean` to `UpsertUserLoginInput`, destructure it, include it in `updateData`, and include it in `create` data:

```ts
type UpsertUserLoginInput = {
  tenantId: string;
  fineractUserId: number;
  username: string;
  email?: string | null;
  phone?: string | null;
  countryCode?: string | null;
  canOverrideInitiatorDisbursement?: boolean;
  canConfirmPayments?: boolean;
  canResetUssdPin?: boolean;
};
```

```ts
  if (canResetUssdPin !== undefined) {
    updateData.canResetUssdPin = canResetUssdPin;
  }
```

```ts
      canResetUssdPin: canResetUssdPin ?? false,
```

- [ ] **Step 5: Update user actions**

In `app/actions/user-management-actions.ts`, add `canResetUssdPin: z.boolean().default(false)` to both create and update schemas.

Every place that selects or maps `canConfirmPayments` from `UserLogin` must also select or map `canResetUssdPin`. The mapped user summary/detail values must use:

```ts
canResetUssdPin: localLogin?.canResetUssdPin ?? false,
```

Every call to `upsertUserLogin` in create/update paths must pass:

```ts
canResetUssdPin: parsed.data.canResetUssdPin,
```

- [ ] **Step 6: Update the user form and user displays**

In `app/(application)/organization/users/components/user-form.tsx`, add `canResetUssdPin` to form state and submit payload. Add a checkbox near `canConfirmPayments`:

```tsx
<div className="flex items-start gap-3 rounded-md border p-3">
  <Checkbox
    id="canResetUssdPin"
    checked={form.canResetUssdPin}
    onCheckedChange={(checked) => handleChange("canResetUssdPin", checked === true)}
  />
  <div className="space-y-1">
    <Label htmlFor="canResetUssdPin">Can reset USSD PIN</Label>
    <p className="text-sm text-muted-foreground">
      Allows this user to reset client USSD PINs from Loan Matrix.
    </p>
  </div>
</div>
```

In `app/(application)/organization/users/components/users-page-client.tsx`, add a column labeled `USSD PIN Reset` that displays `Allowed` or `Not allowed` from `row.original.canResetUssdPin`.

In `app/(application)/organization/users/components/user-detail-tabs.tsx`, add a detail item:

```tsx
<DetailItem
  label="Can Reset USSD PIN"
  value={user.canResetUssdPin ? "Yes" : "No"}
/>
```

- [ ] **Step 7: Update role helper API and hook**

In `app/api/auth/user-roles/route.ts`, select `canResetUssdPin` from `userLogin` and return:

```ts
canResetUssdPin: userLogin?.canResetUssdPin ?? false,
```

In `components/role-guard.tsx`, add to `UserRoleResponse`:

```ts
canResetUssdPin: boolean;
```

Add state and return value:

```ts
const [canResetUssdPin, setCanResetUssdPin] = useState(false);
```

```ts
setCanResetUssdPin(data.canResetUssdPin);
```

```ts
canResetUssdPin,
```

- [ ] **Step 8: Run the permission test to verify it passes**

Run:

```bash
node --import tsx --test lib/__tests__/ussd-admin-pin-reset.test.ts
```

Expected: all current tests in `ussd-admin-pin-reset.test.ts` pass.

- [ ] **Step 9: Commit the permission plumbing**

```bash
git add lib/user-login-service.ts \
        shared/types/user-management.ts \
        app/actions/user-management-actions.ts \
        app/(application)/organization/users/components/user-form.tsx \
        app/(application)/organization/users/components/users-page-client.tsx \
        app/(application)/organization/users/components/user-detail-tabs.tsx \
        app/api/auth/user-roles/route.ts \
        components/role-guard.tsx \
        lib/__tests__/ussd-admin-pin-reset.test.ts
git commit -m "feat: add USSD PIN reset user access flag"
```

---

### Task 5: Add Loan Matrix USSD Admin Client And Access Helper

**Files:**
- Create: `lib/ussd-admin-client.ts`
- Create: `lib/ussd-pin-reset-access.ts`
- Modify: `env.example`
- Modify: `lib/__tests__/ussd-admin-pin-reset.test.ts`

**Interfaces:**
- Produces `lookupUssdUserByPhone(phoneNumber: string): Promise<UssdAdminUserLookup>`
- Produces `resetUssdPin(input: UssdAdminPinResetInput): Promise<UssdAdminPinResetResult>`
- Produces `normalizeUssdPhoneNumber(phoneNumber: string): string | null`
- Produces `canResetUssdPinServer(): Promise<boolean>`
- Produces `requireUssdPinResetAccess(): Promise<void>`

- [ ] **Step 1: Extend the test**

Append:

```ts
test("USSD admin client and access helper use dedicated admin configuration", () => {
  const envExample = readRepoFile("env.example");
  const clientSource = readRepoFile("lib/ussd-admin-client.ts");
  const accessSource = readRepoFile("lib/ussd-pin-reset-access.ts");

  assert.match(envExample, /USSD_ADMIN_API_KEY=/);
  assert.match(clientSource, /USSD_BASE_URL/);
  assert.match(clientSource, /USSD_ADMIN_API_KEY/);
  assert.match(clientSource, /X-USSD-Admin-Key/);
  assert.match(clientSource, /lookupUssdUserByPhone/);
  assert.match(clientSource, /resetUssdPin/);
  assert.doesNotMatch(clientSource, /USSD_LOAN_PRODUCT_SYNC_API_KEY/);
  assert.match(accessSource, /canResetUssdPinServer/);
  assert.match(accessSource, /requireUssdPinResetAccess/);
  assert.match(accessSource, /canResetUssdPin/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --import tsx --test lib/__tests__/ussd-admin-pin-reset.test.ts
```

Expected: the test fails because the client and access helper do not exist.

- [ ] **Step 3: Update `env.example`**

Add:

```bash
# USSD Admin PIN Reset Configuration
USSD_ADMIN_API_KEY=
```

- [ ] **Step 4: Create `lib/ussd-admin-client.ts`**

```ts
export type UssdAdminUserLookup = {
  userId: string;
  fullName: string;
  nationalIdMask?: string | null;
  phoneNumber: string;
  accountNumber?: string | null;
  status?: string | null;
  externalId?: number | null;
  createdAt?: string | null;
};

export type UssdAdminPinResetInput = {
  phoneNumber: string;
  actorUserId: string;
  actorName: string;
  reason: string;
};

export type UssdAdminPinResetResult = {
  success: boolean;
  status: string;
  message: string;
  userId?: string | null;
  fullName?: string | null;
  phoneNumber?: string | null;
  accountNumber?: string | null;
  nationalIdMask?: string | null;
  pinChanged?: boolean | null;
  smsAccepted?: boolean | null;
  newPin?: null;
};

function ussdBaseUrl() {
  return (process.env.USSD_BASE_URL ?? "").replace(/\/$/, "");
}

function ussdAdminApiKey() {
  return process.env.USSD_ADMIN_API_KEY ?? "";
}

export function normalizeUssdPhoneNumber(phoneNumber: string): string | null {
  const digits = String(phoneNumber || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("260")) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return `260${digits.slice(1)}`;
  if (digits.length === 9) return `260${digits}`;
  return digits;
}

async function fetchUssdAdmin<T>(path: string, init?: RequestInit): Promise<T> {
  const base = ussdBaseUrl();
  if (!base) {
    throw new Error("USSD_BASE_URL is not configured");
  }

  const apiKey = ussdAdminApiKey();
  if (!apiKey) {
    throw new Error("USSD_ADMIN_API_KEY is not configured");
  }

  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-USSD-Admin-Key": apiKey,
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = body?.error || body?.message || response.statusText;
    throw new Error(`USSD admin request failed (${response.status}): ${message}`);
  }

  return body as T;
}

export async function lookupUssdUserByPhone(
  phoneNumber: string
): Promise<UssdAdminUserLookup> {
  const encoded = encodeURIComponent(phoneNumber);
  return fetchUssdAdmin<UssdAdminUserLookup>(`/api/v1/admin/users/lookup?phoneNumber=${encoded}`);
}

export async function resetUssdPin(
  input: UssdAdminPinResetInput
): Promise<UssdAdminPinResetResult> {
  return fetchUssdAdmin<UssdAdminPinResetResult>("/api/v1/admin/users/pin-reset", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
```

- [ ] **Step 5: Create `lib/ussd-pin-reset-access.ts`**

```ts
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";

export async function canResetUssdPinServer(): Promise<boolean> {
  const session = await getSession();
  if (!session?.user?.userId) {
    return false;
  }

  if (session.user.name === "mifos") {
    return true;
  }

  const hasSuperAdminRole =
    session.user.roles?.some((role) => role.name === "SUPER_ADMIN" && !role.disabled) ?? false;
  if (hasSuperAdminRole) {
    return true;
  }

  const tenant = await getTenantFromHeaders();
  if (!tenant) {
    return false;
  }

  const userLogin = await prisma.userLogin.findUnique({
    where: {
      tenantId_fineractUserId: {
        tenantId: tenant.id,
        fineractUserId: session.user.userId,
      },
    },
    select: {
      canResetUssdPin: true,
    },
  });

  return userLogin?.canResetUssdPin ?? false;
}

export async function requireUssdPinResetAccess(): Promise<void> {
  const allowed = await canResetUssdPinServer();
  if (!allowed) {
    throw new Error("You do not have permission to reset USSD PINs.");
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run:

```bash
node --import tsx --test lib/__tests__/ussd-admin-pin-reset.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Commit the client/access helper**

```bash
git add env.example lib/ussd-admin-client.ts lib/ussd-pin-reset-access.ts lib/__tests__/ussd-admin-pin-reset.test.ts
git commit -m "feat: add Loan Matrix USSD admin client"
```

---

### Task 6: Add Loan Matrix PIN Reset API Routes

**Files:**
- Create: `app/api/ussd-pin-reset/lookup/route.ts`
- Create: `app/api/ussd-pin-reset/reset/route.ts`
- Create: `app/api/ussd-pin-reset/logs/route.ts`
- Modify: `lib/__tests__/ussd-admin-pin-reset.test.ts`

**Interfaces:**
- Produces `GET /api/ussd-pin-reset/lookup?phoneNumber=...`
- Produces `POST /api/ussd-pin-reset/reset` with `{ phoneNumber, reason }`
- Produces `GET /api/ussd-pin-reset/logs?phoneNumber=...`

- [ ] **Step 1: Extend the test**

Append:

```ts
test("USSD admin PIN reset API routes enforce access and persist logs", () => {
  const lookupRoute = readRepoFile("app/api/ussd-pin-reset/lookup/route.ts");
  const resetRoute = readRepoFile("app/api/ussd-pin-reset/reset/route.ts");
  const logsRoute = readRepoFile("app/api/ussd-pin-reset/logs/route.ts");

  assert.match(lookupRoute, /canResetUssdPinServer/);
  assert.match(lookupRoute, /lookupUssdUserByPhone/);
  assert.match(resetRoute, /canResetUssdPinServer/);
  assert.match(resetRoute, /resetUssdPin/);
  assert.match(resetRoute, /ussdPinResetLog\.create/);
  assert.match(resetRoute, /ussdPinResetLog\.update/);
  assert.match(resetRoute, /reason/);
  assert.doesNotMatch(resetRoute, /newPin:\s*result\.newPin/);
  assert.match(logsRoute, /ussdPinResetLog\.findMany/);
  assert.match(logsRoute, /orderBy:\s*\{\s*createdAt:\s*"desc"\s*\}/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --import tsx --test lib/__tests__/ussd-admin-pin-reset.test.ts
```

Expected: the test fails because API routes do not exist.

- [ ] **Step 3: Create lookup route**

Create `app/api/ussd-pin-reset/lookup/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { canResetUssdPinServer } from "@/lib/ussd-pin-reset-access";
import { lookupUssdUserByPhone } from "@/lib/ussd-admin-client";

export async function GET(request: NextRequest) {
  try {
    const allowed = await canResetUssdPinServer();
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const phoneNumber = request.nextUrl.searchParams.get("phoneNumber")?.trim() ?? "";
    if (!phoneNumber) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    const user = await lookupUssdUserByPhone(phoneNumber);
    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to lookup USSD user";
    const status = message.includes("(404)") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
```

- [ ] **Step 4: Create reset route**

Create `app/api/ussd-pin-reset/reset/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { normalizeUssdPhoneNumber, resetUssdPin } from "@/lib/ussd-admin-client";
import { canResetUssdPinServer } from "@/lib/ussd-pin-reset-access";

export async function POST(request: NextRequest) {
  const session = await getSession();
  const tenant = await getTenantFromHeaders();

  if (!session?.user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const allowed = await canResetUssdPinServer();
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const phoneNumber = typeof body?.phoneNumber === "string" ? body.phoneNumber.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const normalizedPhoneNumber = normalizeUssdPhoneNumber(phoneNumber);

  if (!phoneNumber || !normalizedPhoneNumber) {
    return NextResponse.json({ error: "A valid phone number is required" }, { status: 400 });
  }

  if (reason.length < 5) {
    return NextResponse.json({ error: "A reset reason of at least 5 characters is required" }, { status: 400 });
  }

  const log = await prisma.ussdPinResetLog.create({
    data: {
      tenantId: tenant.id,
      requestedPhoneNumber: phoneNumber,
      normalizedPhoneNumber,
      status: "PENDING",
      reason,
      actorUserId: session.user.userId,
      actorName: session.user.name || session.user.email || "Unknown user",
    },
  });

  try {
    const result = await resetUssdPin({
      phoneNumber,
      actorUserId: String(session.user.userId),
      actorName: session.user.name || session.user.email || "Unknown user",
      reason,
    });

    const updatedLog = await prisma.ussdPinResetLog.update({
      where: { id: log.id },
      data: {
        status: result.status,
        ussdUserId: result.userId ?? null,
        clientFullName: result.fullName ?? null,
        clientNationalIdMask: result.nationalIdMask ?? null,
        accountNumber: result.accountNumber ?? null,
        errorMessage: result.success ? null : result.message,
        metadata: {
          pinChanged: result.pinChanged ?? null,
          smsAccepted: result.smsAccepted ?? null,
          message: result.message,
        },
      },
    });

    const status = result.success ? 200 : 400;
    return NextResponse.json({ result: { ...result, newPin: null }, log: updatedLog }, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "USSD PIN reset failed";
    const updatedLog = await prisma.ussdPinResetLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        errorMessage: message,
        metadata: { message },
      },
    });

    return NextResponse.json({ error: message, log: updatedLog }, { status: 500 });
  }
}
```

- [ ] **Step 5: Create logs route**

Create `app/api/ussd-pin-reset/logs/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { normalizeUssdPhoneNumber } from "@/lib/ussd-admin-client";
import { canResetUssdPinServer } from "@/lib/ussd-pin-reset-access";

export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const allowed = await canResetUssdPinServer();
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const phoneNumber = request.nextUrl.searchParams.get("phoneNumber")?.trim() ?? "";
    const normalizedPhoneNumber = phoneNumber ? normalizeUssdPhoneNumber(phoneNumber) : null;

    const logs = await prisma.ussdPinResetLog.findMany({
      where: {
        tenantId: tenant.id,
        ...(normalizedPhoneNumber ? { normalizedPhoneNumber } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load USSD PIN reset logs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 6: Run the route test to verify it passes**

Run:

```bash
node --import tsx --test lib/__tests__/ussd-admin-pin-reset.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Commit the API routes**

```bash
git add app/api/ussd-pin-reset/lookup/route.ts \
        app/api/ussd-pin-reset/reset/route.ts \
        app/api/ussd-pin-reset/logs/route.ts \
        lib/__tests__/ussd-admin-pin-reset.test.ts
git commit -m "feat: add USSD PIN reset API routes"
```

---

### Task 7: Add Loan Matrix Reset Screen And Navigation

**Files:**
- Create: `app/(application)/ussd-pin-reset/page.tsx`
- Create: `app/(application)/ussd-pin-reset/components/ussd-pin-reset-client.tsx`
- Modify: `app/(application)/components/sidebar-nav.tsx`
- Modify: `app/(application)/components/mobile-sidebar.tsx`
- Modify: `lib/__tests__/ussd-admin-pin-reset.test.ts`

**Interfaces:**
- Consumes:
  - `GET /api/ussd-pin-reset/lookup?phoneNumber=...`
  - `POST /api/ussd-pin-reset/reset`
  - `GET /api/ussd-pin-reset/logs?phoneNumber=...`
- Produces route `/ussd-pin-reset`.

- [ ] **Step 1: Extend the test**

Append:

```ts
test("USSD admin PIN reset screen exists and is linked from navigation", () => {
  const pageSource = readRepoFile("app/(application)/ussd-pin-reset/page.tsx");
  const clientSource = readRepoFile(
    "app/(application)/ussd-pin-reset/components/ussd-pin-reset-client.tsx"
  );
  const desktopSidebarSource = readRepoFile("app/(application)/components/sidebar-nav.tsx");
  const mobileSidebarSource = readRepoFile("app/(application)/components/mobile-sidebar.tsx");

  assert.match(pageSource, /UssdPinResetClient/);
  assert.match(pageSource, /canResetUssdPinServer/);
  assert.match(clientSource, /\/api\/ussd-pin-reset\/lookup/);
  assert.match(clientSource, /\/api\/ussd-pin-reset\/reset/);
  assert.match(clientSource, /\/api\/ussd-pin-reset\/logs/);
  assert.match(clientSource, /Reset reason/);
  assert.match(clientSource, /USSD PIN was reset by Goodfellow staff/);
  assert.doesNotMatch(clientSource, /newPin/);
  assert.match(desktopSidebarSource, /USSD PIN Reset/);
  assert.match(desktopSidebarSource, /\/ussd-pin-reset/);
  assert.match(mobileSidebarSource, /USSD PIN Reset/);
  assert.match(mobileSidebarSource, /\/ussd-pin-reset/);
});
```

- [ ] **Step 2: Run the UI/navigation test to verify it fails**

Run:

```bash
node --import tsx --test lib/__tests__/ussd-admin-pin-reset.test.ts
```

Expected: the test fails because the page and navigation are not present.

- [ ] **Step 3: Create the server page**

Create `app/(application)/ussd-pin-reset/page.tsx`:

```tsx
import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { canResetUssdPinServer } from "@/lib/ussd-pin-reset-access";
import { UssdPinResetClient } from "./components/ussd-pin-reset-client";

export const metadata: Metadata = {
  title: "USSD PIN Reset | KENAC Loan Matrix",
  description: "Reset client USSD PINs through the secured USSD admin workflow",
};

export default async function UssdPinResetPage() {
  const canReset = await canResetUssdPinServer();

  if (!canReset) {
    return (
      <Alert variant="destructive">
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>
          You do not have permission to reset USSD PINs.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">USSD PIN Reset</h1>
        <p className="mt-1 text-muted-foreground">
          Find a USSD client and trigger a staff-assisted PIN reset SMS.
        </p>
      </div>
      <UssdPinResetClient />
    </div>
  );
}
```

- [ ] **Step 4: Create the client component**

Create `app/(application)/ussd-pin-reset/components/ussd-pin-reset-client.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type LookupUser = {
  userId: string;
  fullName: string;
  nationalIdMask?: string | null;
  phoneNumber: string;
  accountNumber?: string | null;
  status?: string | null;
};

type ResetLog = {
  id: string;
  normalizedPhoneNumber: string;
  clientFullName?: string | null;
  accountNumber?: string | null;
  status: string;
  reason: string;
  errorMessage?: string | null;
  actorName?: string | null;
  createdAt: string;
};

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Request failed");
  }
  return data;
}

export function UssdPinResetClient() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [reason, setReason] = useState("");
  const [user, setUser] = useState<LookupUser | null>(null);
  const [logs, setLogs] = useState<ResetLog[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadLogs(targetPhone = phoneNumber) {
    const suffix = targetPhone.trim()
      ? `?phoneNumber=${encodeURIComponent(targetPhone.trim())}`
      : "";
    const data = await readJson(await fetch(`/api/ussd-pin-reset/logs${suffix}`));
    setLogs(data.logs ?? []);
  }

  useEffect(() => {
    void loadLogs("");
  }, []);

  async function handleLookup() {
    const trimmed = phoneNumber.trim();
    if (!trimmed) {
      toast.error("Enter a phone number");
      return;
    }

    setLookupLoading(true);
    setMessage(null);
    setUser(null);
    try {
      const data = await readJson(
        await fetch(`/api/ussd-pin-reset/lookup?phoneNumber=${encodeURIComponent(trimmed)}`)
      );
      setUser(data.user);
      await loadLogs(trimmed);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Lookup failed";
      toast.error(text);
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleReset() {
    if (!user) {
      toast.error("Search for a USSD client first");
      return;
    }

    if (reason.trim().length < 5) {
      toast.error("Enter a reset reason");
      return;
    }

    setResetLoading(true);
    setMessage(null);
    try {
      const data = await readJson(
        await fetch("/api/ussd-pin-reset/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phoneNumber: phoneNumber.trim(),
            reason: reason.trim(),
          }),
        })
      );
      setMessage(
        data?.result?.message ||
          "USSD PIN was reset by Goodfellow staff and the new PIN was sent by SMS."
      );
      setReason("");
      await loadLogs(phoneNumber);
      toast.success("USSD PIN reset request completed");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Reset failed";
      toast.error(text);
      await loadLogs(phoneNumber);
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Find Client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ussd-phone-number">Phone number</Label>
              <div className="flex gap-2">
                <Input
                  id="ussd-phone-number"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  placeholder="0977123456"
                />
                <Button type="button" onClick={handleLookup} disabled={lookupLoading}>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </Button>
              </div>
            </div>

            {user && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{user.fullName}</p>
                    <p className="text-sm text-muted-foreground">{user.phoneNumber}</p>
                  </div>
                  <Badge variant="secondary">{user.status || "ACTIVE"}</Badge>
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">NRC</span>
                    <span>{user.nationalIdMask || "Not available"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Account</span>
                    <span>{user.accountNumber || "Not available"}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reset PIN</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertDescription>
                USSD will generate a new PIN and send the staff-reset SMS to the client.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="reset-reason">Reset reason</Label>
              <Textarea
                id="reset-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Client verified at branch"
                rows={4}
              />
            </div>
            <Button
              type="button"
              onClick={handleReset}
              disabled={!user || resetLoading || reason.trim().length < 5}
              className="w-full"
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Reset USSD PIN
            </Button>
            {message && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Reset Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No reset logs found.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.clientFullName || "Not available"}</TableCell>
                    <TableCell>{log.normalizedPhoneNumber}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === "SUCCESS" ? "secondary" : "outline"}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate">{log.reason}</TableCell>
                    <TableCell>{log.actorName || "Unknown"}</TableCell>
                    <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {logs.some((log) => log.errorMessage) && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                One or more reset attempts failed. Open the latest failed row in the database log for details.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Add desktop navigation**

In `app/(application)/components/sidebar-nav.tsx`, include `canResetUssdPin` from `useUserRoles()` and add this item under the Leads or System section. Recommended location is under Leads after `USSD Leads` because the feature serves USSD clients:

```tsx
if (!rolesLoading && canResetUssdPin) {
  leadsSubMenuItems.push({
    label: "USSD PIN Reset",
    href: "/ussd-pin-reset",
  });
}
```

- [ ] **Step 6: Add mobile navigation**

In `app/(application)/components/mobile-sidebar.tsx`, add the same route in the mobile Leads submenu and gate it with `canResetUssdPin`.

- [ ] **Step 7: Run the UI/navigation test**

Run:

```bash
node --import tsx --test lib/__tests__/ussd-admin-pin-reset.test.ts
```

Expected: all tests pass.

- [ ] **Step 8: Commit the screen and navigation**

```bash
git add app/(application)/ussd-pin-reset \
        app/(application)/components/sidebar-nav.tsx \
        app/(application)/components/mobile-sidebar.tsx \
        lib/__tests__/ussd-admin-pin-reset.test.ts
git commit -m "feat: add USSD PIN reset workspace"
```

---

### Task 8: Final Verification And Deployment Notes

**Files:**
- Modify only files that fail verification.

**Interfaces:**
- Consumes all previous tasks.
- Produces a verified cross-repo implementation.

- [ ] **Step 1: Run USSD focused tests**

Run:

```bash
cd "/home/parten/Documents/kenac dev/USSD/GoodFellowUssd"
./mvnw -Dtest=AdminPinResetServiceTest,AdminPinResetControllerTest test
```

Expected: all tests pass.

- [ ] **Step 2: Run USSD compile**

Run:

```bash
./mvnw compile -q
```

Expected: compile succeeds.

- [ ] **Step 3: Run Loan Matrix focused test**

Run:

```bash
cd "/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix"
node --import tsx --test lib/__tests__/ussd-admin-pin-reset.test.ts
```

Expected: all tests pass.

- [ ] **Step 4: Run Loan Matrix lint on touched files**

Run:

```bash
npx eslint \
  lib/ussd-admin-client.ts \
  lib/ussd-pin-reset-access.ts \
  app/api/ussd-pin-reset/lookup/route.ts \
  app/api/ussd-pin-reset/reset/route.ts \
  app/api/ussd-pin-reset/logs/route.ts \
  app/(application)/ussd-pin-reset/page.tsx \
  app/(application)/ussd-pin-reset/components/ussd-pin-reset-client.tsx \
  app/(application)/components/sidebar-nav.tsx \
  app/(application)/components/mobile-sidebar.tsx \
  components/role-guard.tsx \
  app/api/auth/user-roles/route.ts \
  lib/user-login-service.ts \
  app/actions/user-management-actions.ts \
  shared/types/user-management.ts \
  lib/__tests__/ussd-admin-pin-reset.test.ts
```

Expected: lint succeeds.

- [ ] **Step 5: Manually verify the happy path in development**

1. Set matching secrets:

```bash
# USSD
USSD_ADMIN_API_KEY=local-admin-pin-reset-key

# Loan Matrix
USSD_BASE_URL=http://localhost:8080
USSD_ADMIN_API_KEY=local-admin-pin-reset-key
```

2. Start USSD:

```bash
cd "/home/parten/Documents/kenac dev/USSD/GoodFellowUssd"
./mvnw spring-boot:run
```

3. Start Loan Matrix:

```bash
cd "/home/parten/Documents/kenac dev/Loan Matrix/loan-matrix"
npm run dev
```

4. Open `/ussd-pin-reset`.
5. Search a known USSD phone number.
6. Confirm safe details render and no PIN is shown.
7. Enter a reset reason.
8. Submit reset.
9. Confirm the log row appears with `SUCCESS`.
10. Confirm the client receives an SMS with this sentiment:

```text
Dear [Customer], your Goodfellow USSD PIN was reset by Goodfellow staff. Your new PIN is [PIN]. If you did not request this reset, contact Goodfellow Finance Ltd immediately.
```

- [ ] **Step 6: Commit final verification fixes**

If verification required changes, commit them:

```bash
git add .
git commit -m "fix: verify USSD admin PIN reset workflow"
```

If verification required no changes, do not create an empty commit.

---

## Rollout Checklist

- [ ] Add `USSD_ADMIN_API_KEY` to USSD deployment secrets.
- [ ] Add the same `USSD_ADMIN_API_KEY` to Loan Matrix deployment secrets.
- [ ] Keep `USSD_LOAN_PRODUCT_SYNC_API_KEY` unchanged.
- [ ] Apply the Loan Matrix Prisma migration.
- [ ] Deploy USSD before Loan Matrix so the admin endpoint exists when Loan Matrix calls it.
- [ ] Grant `canResetUssdPin` only to approved operations/admin users.
- [ ] Perform one controlled reset in UAT and confirm the SMS wording with operations.

## Self-Review

- Spec coverage: The plan includes the authorized Loan Matrix screen, USSD user lookup, reset button, Loan Matrix log table, USSD-owned SMS sending, and admin-specific reset SMS wording.
- Placeholder scan: The plan contains no placeholder sections and all named files have concrete responsibilities.
- Type consistency: `canResetUssdPin`, `UssdPinResetLog`, `lookupUssdUserByPhone`, and `resetUssdPin` names are consistent across tasks.
