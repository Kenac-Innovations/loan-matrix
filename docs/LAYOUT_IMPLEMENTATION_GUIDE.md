# Application Layout Implementation Guide

This document provides a comprehensive guide for replicating the UI layout of the Loan Matrix application. It covers the main layout structure, including the sidebar navigation, top navbar, main content area, and floating AI assistant.

## Table of Contents

1. [Overall Layout Architecture](#overall-layout-architecture)
2. [Desktop Sidebar (Sidenav)](#desktop-sidebar-sidenav)
3. [Mobile Sidebar](#mobile-sidebar)
4. [Top Navbar (Header)](#top-navbar-header)
5. [Main Content Area (Staging Area)](#main-content-area-staging-area)
6. [Floating AI Assistant](#floating-ai-assistant)
7. [Theme System](#theme-system)
8. [Key Components](#key-components)
9. [File Structure](#file-structure)

---

## Overall Layout Architecture

The application uses a **flex-based layout** with three main zones:

```
┌─────────────────────────────────────────────────────────────────┐
│                    FULL SCREEN (h-screen)                       │
├───────────────┬─────────────────────────────────────────────────┤
│               │              TOP NAVBAR (h-16)                  │
│   DESKTOP     ├─────────────────────────────────────────────────┤
│   SIDEBAR     │                                                 │
│   (w-64)      │           MAIN CONTENT AREA                     │
│               │           (flex-1, overflow-y-auto)             │
│   Hidden on   │           Padding: p-8                          │
│   mobile      │                                                 │
│   (lg:block)  │                                                 │
├───────────────┴─────────────────────────────────────────────────┤
│                   FLOATING AI ASSISTANT (bottom-right)          │
└─────────────────────────────────────────────────────────────────┘
```

### Root Layout Structure

```tsx
// app/(application)/layout.tsx
<ChatProvider>
  <MobileMenuProvider>
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden lg:block lg:w-64 ...">
        {/* Sidebar content */}
      </div>

      {/* Mobile Sidebar - slide-in drawer */}
      <MobileSidebar />

      {/* Main Content Column */}
      <div className="flex flex-1 flex-col h-screen overflow-hidden">
        {/* Top Navbar */}
        <UserProfileClient />
        
        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8 bg-background">
          {children}
        </main>
      </div>

      {/* Floating AI Assistant */}
      <AIAssistant />
    </div>
  </MobileMenuProvider>
</ChatProvider>
```

---

## Desktop Sidebar (Sidenav)

### Specifications

| Property | Value |
|----------|-------|
| Width | `w-64` (256px) |
| Visibility | `hidden lg:block` (visible on screens ≥1024px) |
| Position | `sticky top-0` |
| Height | `h-screen` |
| Z-Index | `z-30` |
| Background | `bg-background` |
| Border | `border-r border-border` |
| Overflow | `overflow-y-auto` |

### Structure

```tsx
<div className="hidden lg:block lg:w-64 bg-background border-border border-r h-screen sticky top-0 z-30 overflow-y-auto">
  
  {/* Logo Header - Fixed at top */}
  <div className="flex h-16 items-center justify-center border-border border-b px-4 sticky top-0 bg-background z-10">
    <Image src="/logo_light.png" className="dark:hidden" />
    <Image src="/logo_dark.png" className="hidden dark:block" />
  </div>
  
  {/* Tenant Display (optional) */}
  <TenantDisplay />
  
  {/* Navigation Area */}
  <div className="py-4 h-[calc(100vh-7rem)] overflow-y-auto">
    <nav className="space-y-1 px-2">
      {/* Navigation Items */}
    </nav>
  </div>
</div>
```

### Navigation Item Styles

#### Standard Link
```tsx
<Link
  href="/path"
  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
>
  <Icon className="h-4 w-4" />
  Label
</Link>
```

#### Menu with Submenu (Expandable)
```tsx
// components/menu-with-sub.tsx
interface SubMenuItem {
  label: string;
  href: string;
}

interface MenuItemWithSubmenuProps {
  icon: React.ReactElement;
  label: string;
  href: string;
  subMenuItems?: SubMenuItem[];
}
```

**Behavior:**
- Parent link shows icon + label
- When active (based on pathname), submenu items expand below
- Submenu items are indented (`pl-9`)
- Active submenu items have `text-blue-400`

#### Navigation Items in Current Implementation

| Icon | Label | Path | Submenu Items |
|------|-------|------|---------------|
| TrendingUp | Leads | /leads | Pipeline, USSD Leads, Configuration |
| CreditCard | Loans | /loans | - |
| Users | Clients | /clients | All Clients, Add Client |
| Wallet | Tellers | /tellers | - |
| BarChart3 | Accounting | /accounting | Home, Chart of Accounts, Journal Entries, Frequent Postings |
| FileText | Reports | /reports | - |
| Bot | AI Assistant | /ai-assistant | Chat, Admin |

### Tenant Display Component

Shows the current tenant/organization above the navigation:

```tsx
// components/tenant-display.tsx
<div className="px-4 py-3 border-b border-border">
  <div className="flex items-center gap-2 text-sm">
    <Building2 className="h-4 w-4 text-muted-foreground" />
    <span className="font-medium text-foreground">{tenant.name}</span>
  </div>
</div>
```

---

## Mobile Sidebar

### Specifications

| Property | Value |
|----------|-------|
| Width | `w-64` (256px) |
| Position | `fixed inset-y-0 left-0` |
| Z-Index | `z-50` |
| Visibility | `lg:hidden` (hidden on screens ≥1024px) |
| Animation | `transform transition-transform duration-300 ease-in-out` |
| Closed State | `-translate-x-full` |
| Open State | `translate-x-0` |

### Structure

```tsx
// app/(application)/components/mobile-sidebar.tsx

{/* Overlay backdrop when open */}
{mobileMenuOpen && (
  <div
    className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
    onClick={() => setMobileMenuOpen(false)}
  />
)}

{/* Sidebar drawer */}
<div
  className={`fixed inset-y-0 left-0 z-50 w-64 bg-background transform transition-transform duration-300 ease-in-out lg:hidden ${
    mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
  }`}
>
  {/* Header with logo and close button */}
  <div className="flex h-16 items-center justify-between border-b px-4">
    <Image src="/logo.png" />
    <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
      <X className="h-5 w-5" />
    </Button>
  </div>
  
  {/* Navigation (same as desktop but with touch-friendly spacing) */}
  <nav className="space-y-1 px-2">
    {/* py-3 instead of py-2 for touch targets */}
  </nav>
</div>
```

### Mobile Menu Context

Shared state for mobile menu open/close:

```tsx
// app/(application)/components/mobile-menu-context.tsx
interface MobileMenuContextType {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

const MobileMenuContext = createContext<MobileMenuContextType | undefined>(undefined);

export function MobileMenuProvider({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <MobileMenuContext.Provider value={{ mobileMenuOpen, setMobileMenuOpen }}>
      {children}
    </MobileMenuContext.Provider>
  );
}

export function useMobileMenu() {
  const context = useContext(MobileMenuContext);
  if (!context) throw new Error("useMobileMenu must be used within MobileMenuProvider");
  return context;
}
```

### Key Behaviors

1. **Auto-close on route change:** `useEffect` watches `pathname` and closes menu
2. **Click outside to close:** Event listener on document for clicks outside menu
3. **Body scroll lock:** When open, sets `document.body.style.overflow = "hidden"`

---

## Top Navbar (Header)

### Specifications

| Property | Value |
|----------|-------|
| Height | `h-16` (64px) |
| Position | `sticky top-0` |
| Z-Index | `z-20` |
| Background | `bg-background` |
| Border | `border-b border-border` |
| Padding | `px-4 lg:px-6` |

### Structure

```tsx
// app/(application)/components/user-profile-client.tsx

<header className="flex h-16 items-center justify-between border-border border-b bg-background px-4 lg:px-6 sticky top-0 z-20">
  
  {/* LEFT SIDE */}
  
  {/* Mobile menu toggle (lg:hidden) */}
  <div className="lg:hidden">
    <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)}>
      <Menu className="h-6 w-6" />
    </Button>
  </div>
  
  {/* Search bar */}
  <div className="relative w-full max-w-sm mx-4">
    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
    <input
      type="search"
      placeholder="Search..."
      className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-4 text-sm"
    />
  </div>
  
  {/* RIGHT SIDE */}
  <div className="flex items-center gap-2 lg:gap-4">
    
    {/* Theme toggle (desktop only) */}
    <div className="hidden lg:block">
      <ThemeToggle />
    </div>
    
    {/* Notifications dropdown */}
    <div className="relative">
      <Button variant="ghost" size="icon">
        <Bell className="h-5 w-5" />
      </Button>
      {/* Dropdown panel */}
    </div>
    
    {/* User profile dropdown */}
    <div className="relative">
      <Button variant="ghost" className="rounded-full p-1">
        {/* Mobile: Avatar only */}
        <div className="lg:hidden">
          <Avatar className="h-8 w-8 border-2 border-blue-500">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </div>
        
        {/* Desktop: Full profile pill */}
        <div className="hidden lg:flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1">
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
            {userFullName}
          </span>
          <Avatar className="h-8 w-8 border-2 border-blue-500">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </div>
      </Button>
      {/* Profile dropdown panel */}
    </div>
  </div>
</header>
```

### Notification Dropdown Structure

```tsx
<div className="absolute right-0 mt-2 w-80 rounded-md border border-border bg-background shadow-lg z-50">
  {/* Header */}
  <div className="p-3 border-b border-border">
    <h3 className="text-sm font-medium">Notifications</h3>
  </div>
  
  {/* Scrollable content */}
  <div className="max-h-[400px] overflow-y-auto">
    {/* Grouped sections */}
    <div className="p-2">
      <h4 className="text-xs font-semibold text-muted-foreground px-2 py-1">
        CATEGORY HEADER
      </h4>
      <div className="mt-1 space-y-1">
        {/* Notification items */}
        <button className="w-full text-left rounded-md p-2 hover:bg-accent">
          <div className="flex items-start gap-2">
            <div className="rounded-full bg-blue-500/20 p-1 mt-0.5">
              <Icon className="h-3 w-3 text-blue-500" />
            </div>
            <div>
              <p className="text-xs font-medium">Title</p>
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="text-xs text-gray-500">Time ago</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
  
  {/* Footer */}
  <div className="p-2 border-t border-border">
    <Button variant="outline" size="sm" className="w-full">
      View All Notifications
    </Button>
  </div>
</div>
```

### User Profile Dropdown Structure

```tsx
<div className="absolute right-0 mt-2 w-64 rounded-md border border-border bg-background shadow-lg z-50">
  {/* User info header */}
  <div className="p-4 border-b border-border">
    <div className="flex items-center gap-3">
      <Avatar className="h-10 w-10 border-2 border-blue-500">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div>
        <p className="text-sm font-medium">{userFullName}</p>
        <p className="text-xs text-muted-foreground">{userEmail}</p>
      </div>
    </div>
    {/* Role badges */}
    <div className="mt-3 flex flex-wrap gap-1">
      {roles.map((role) => (
        <Badge className="bg-blue-500 text-white text-xs">{role.name}</Badge>
      ))}
    </div>
  </div>
  
  {/* Menu items */}
  <div className="py-2">
    <button className="flex w-full items-center gap-3 px-4 py-2 text-sm hover:bg-accent">
      <User className="h-4 w-4 text-muted-foreground" />
      <span>My Profile</span>
    </button>
    {/* More items... */}
  </div>
  
  {/* Sign out section */}
  <div className="border-t border-border py-2">
    <button className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-accent">
      <LogOut className="h-4 w-4 text-red-400" />
      <span>Sign Out</span>
    </button>
  </div>
</div>
```

---

## Main Content Area (Staging Area)

### Specifications

| Property | Value |
|----------|-------|
| Flex | `flex-1` (fills remaining space) |
| Overflow | `overflow-y-auto` (scrollable content) |
| Padding | `p-8` |
| Background | `bg-background` |

### Structure

```tsx
<main className="flex-1 overflow-y-auto p-8 bg-background">
  <Suspense fallback={<div>Loading...</div>}>
    {children}
  </Suspense>
</main>
```

### Page Content Guidelines

Each page within the main content area should follow this general structure:

```tsx
export default function Page() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Page Title</h1>
          <p className="text-muted-foreground">Page description</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Action buttons */}
          <Button>Primary Action</Button>
        </div>
      </div>
      
      {/* Page Content */}
      <Card>
        <CardHeader>
          <CardTitle>Section Title</CardTitle>
          <CardDescription>Section description</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Content */}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Floating AI Assistant

### Specifications

| Property | Value |
|----------|-------|
| Position | `fixed bottom-6 right-6` |
| Z-Index | `z-50` |
| FAB Size | `h-14 w-14` (56px) |
| Dialog Width | `sm:w-96` |
| Dialog Height | `sm:h-[600px]` or `h-[85vh]` on mobile |

### Structure

```tsx
// components/ai-assistant.tsx

export function AIAssistant() {
  const pathname = usePathname();
  
  // Hide FAB on dedicated AI page
  if (pathname === "/ai-assistant") return null;
  
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      {/* Floating Action Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 shadow-lg z-50"
      >
        <MessageSquare className="h-6 w-6 text-white" />
      </Button>
      
      {/* Chat Dialog */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsOpen(false)} />
          
          {/* Dialog */}
          <div className="fixed bottom-0 right-0 z-50 w-full sm:bottom-6 sm:right-6 sm:w-96">
            <Card className="h-[85vh] sm:h-[600px] flex flex-col">
              {/* Header */}
              <CardHeader className="border-b flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8 bg-blue-500">
                      <AvatarFallback><Bot /></AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-sm">AI Assistant</CardTitle>
                      <CardDescription className="text-xs">Powered by RAG</CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                    <X />
                  </Button>
                </div>
              </CardHeader>
              
              {/* Messages area */}
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full p-4">
                  {/* Messages */}
                </ScrollArea>
              </div>
              
              {/* Input footer */}
              <CardFooter className="border-t p-4">
                <div className="flex w-full gap-2">
                  <Textarea placeholder="Ask a question..." />
                  <Button><Send /></Button>
                </div>
              </CardFooter>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
```

---

## Theme System

### CSS Variables

The application uses CSS custom properties for theming. Variables are defined in `app/globals.css`:

```css
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}

.dark {
  --background: #101828;
  --foreground: oklch(0.985 0 0);
  --card: #1e2938;
  --card-foreground: oklch(0.985 0 0);
  --popover: #1e2938;
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: #101828;
  --secondary: #374151;
  --secondary-foreground: oklch(0.985 0 0);
  --muted: #374151;
  --muted-foreground: oklch(0.708 0 0);
  --accent: #374151;
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
}
```

### Theme Toggle Component

```tsx
// components/theme-toggle.tsx
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="h-9 w-9 rounded-full"
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
```

### Dark/Light Logo Switching

```tsx
{/* Light mode logo */}
<Image src="/logo_light.png" className="dark:hidden" />

{/* Dark mode logo */}
<Image src="/logo_dark.png" className="hidden dark:block" />
```

---

## Key Components

### UI Components Used (shadcn/ui)

| Component | Usage |
|-----------|-------|
| `Button` | Actions, toggles, navigation |
| `Card`, `CardHeader`, `CardContent`, `CardFooter` | Content containers |
| `Avatar`, `AvatarFallback`, `AvatarImage` | User profile images |
| `Badge` | Role indicators, status tags |
| `ScrollArea` | Scrollable containers |
| `Textarea` | Multi-line input |
| `Input` | Single-line input |

### Icon Library

Uses `lucide-react` for icons:

```tsx
import {
  Home, Users, CreditCard, FileText, BarChart3, Bot,
  Settings, Bell, Search, Menu, X, LogOut, User,
  Sun, Moon, Send, MessageSquare, Building2, TrendingUp, Wallet
} from "lucide-react";
```

---

## File Structure

```
app/
├── (application)/
│   ├── layout.tsx                    # Main dashboard layout
│   ├── components/
│   │   ├── mobile-sidebar.tsx        # Mobile navigation drawer
│   │   ├── mobile-menu-context.tsx   # Shared mobile menu state
│   │   ├── user-profile-client.tsx   # Top navbar component
│   │   └── user-profile-data.tsx     # Server-side user data fetching
│   └── [page folders]/
│       └── page.tsx                  # Individual pages
│
├── globals.css                       # Theme CSS variables
│
components/
├── ui/                               # shadcn/ui components
│   ├── button.tsx
│   ├── card.tsx
│   ├── avatar.tsx
│   ├── badge.tsx
│   └── ...
├── menu-with-sub.tsx                 # Expandable menu component
├── tenant-display.tsx                # Server component for tenant
├── tenant-display-client.tsx         # Client component for tenant
├── theme-toggle.tsx                  # Dark/light mode toggle
└── ai-assistant.tsx                  # Floating chat assistant
│
contexts/
├── chat-context.tsx                  # AI chat state management
└── ...
```

---

## Responsive Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| Default | 0px+ | Mobile styles |
| `sm:` | 640px+ | Small adjustments |
| `lg:` | 1024px+ | Desktop sidebar visible |

### Key Responsive Patterns

```tsx
// Show on desktop, hide on mobile
className="hidden lg:block"

// Show on mobile, hide on desktop
className="lg:hidden"

// Different sizing
className="gap-2 lg:gap-4"
className="px-4 lg:px-6"
```

---

## Implementation Checklist

To replicate this layout in a new application:

- [ ] Set up Tailwind CSS with CSS variables for theming
- [ ] Install shadcn/ui components (Button, Card, Avatar, Badge, etc.)
- [ ] Install lucide-react for icons
- [ ] Install next-themes for dark mode support
- [ ] Create the main layout with flex container
- [ ] Implement desktop sidebar with navigation
- [ ] Implement mobile sidebar with slide-in animation
- [ ] Create mobile menu context for shared state
- [ ] Build top navbar with search, notifications, and profile
- [ ] Add theme toggle functionality
- [ ] Implement floating AI assistant (optional)
- [ ] Set up proper z-index layering (sidebar: 30, header: 20, mobile: 40-50)
- [ ] Test responsive behavior across breakpoints
