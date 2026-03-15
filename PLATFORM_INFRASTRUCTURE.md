# MFI Insights Platform - Infrastructure Specification

> **GitOps Agent Reference Document**
> This file is the single source of truth for the Kubernetes cluster configuration.
> All infrastructure changes must be reflected here before being applied.

---

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [Cluster Specification](#cluster-specification)
3. [Namespace Layout](#namespace-layout)
4. [Core Infrastructure](#core-infrastructure)
5. [Data Tier](#data-tier)
6. [Messaging & Streaming](#messaging--streaming)
7. [Application Tier](#application-tier)
8. [Data Governance](#data-governance)
9. [Security](#security)
10. [Observability](#observability)
11. [GitOps Configuration](#gitops-configuration)
12. [Deployment Order](#deployment-order)
13. [Resource Budgets](#resource-budgets)
14. [Disaster Recovery](#disaster-recovery)
15. [Runbooks](#runbooks)

---

## Platform Overview

**Product:** AI-powered data intelligence platform for microfinance institutions.
**Architecture:** Multi-tenant SaaS on Kubernetes with event-driven data pipelines.
**Cloud Provider:** Configurable (AWS EKS / GCP GKE / Azure AKS / Bare Metal)

### High-Level Architecture

```
Internet
   │
   ├─► Cloudflare (DNS + WAF + DDoS protection)
   │
   ├─► Ingress (NGINX Ingress Controller)
   │      │
   │      ├─► Frontend (Next.js)          ─── app.mfiinsights.com
   │      ├─► API Gateway (Kong)          ─── api.mfiinsights.com
   │      ├─► OpenMetadata                ─── catalog.mfiinsights.com (internal)
   │      └─► Grafana                     ─── monitoring.mfiinsights.com (internal)
   │
   └─► Internal Service Mesh (Istio mTLS)
          │
          ├─► Application Services
          │     ├── web (Next.js SSR)
          │     ├── ingestion-worker
          │     ├── ai-worker
          │     └── query-service
          │
          ├─► Streaming
          │     ├── Kafka (Strimzi) + Schema Registry
          │     └── Debezium (CDC connectors)
          │
          ├─► Storage
          │     ├── PostgreSQL (CloudNativePG)
          │     ├── ClickHouse (Altinity Operator)
          │     ├── MinIO (Object Storage)
          │     └── Redis (Sentinel)
          │
          ├─► Governance
          │     ├── HashiCorp Vault
          │     ├── OpenMetadata
          │     ├── Open Policy Agent (OPA)
          │     └── Audit Service
          │
          └─► Observability
                ├── Prometheus + Alertmanager
                ├── Grafana
                ├── Loki (logs)
                └── Tempo (traces)
```

---

## Cluster Specification

### Minimum Production Cluster

| Node Pool         | Count | Instance Type        | vCPU | RAM   | Disk   | Purpose                        |
|-------------------|-------|----------------------|------|-------|--------|--------------------------------|
| `system`          | 3     | t3.medium / e2-medium| 2    | 4 GB  | 50 GB  | K8s system, ingress, monitoring|
| `app`             | 3     | t3.large / e2-standard-4 | 4 | 16 GB | 100 GB | Application workloads          |
| `data`            | 3     | r6i.xlarge / n2-highmem-4 | 4 | 32 GB | 500 GB SSD | ClickHouse, PostgreSQL, Kafka |
| `ai-workers`      | 2     | c6i.xlarge / c2-standard-4 | 4 | 8 GB | 50 GB  | AI/ML workloads (autoscalable) |

### Minimum Development Cluster

| Node Pool         | Count | Instance Type        | vCPU | RAM   | Disk   |
|-------------------|-------|----------------------|------|-------|--------|
| `general`         | 3     | t3.large / e2-standard-4 | 4 | 16 GB | 200 GB |

### Kubernetes Version

```yaml
kubernetes_version: "1.29"
container_runtime: containerd
cni: cilium  # Or calico. Cilium preferred for network policy + observability.
```

---

## Namespace Layout

```yaml
namespaces:
  # --- Core Platform ---
  - name: mfi-app
    description: Application services (web, API, workers)
    resource_quota:
      requests.cpu: "8"
      requests.memory: "16Gi"
      limits.cpu: "16"
      limits.memory: "32Gi"

  # --- Data Infrastructure ---
  - name: mfi-data
    description: Databases and storage (PostgreSQL, ClickHouse, MinIO)
    resource_quota:
      requests.cpu: "12"
      requests.memory: "48Gi"
      limits.cpu: "24"
      limits.memory: "96Gi"

  # --- Streaming ---
  - name: mfi-streaming
    description: Kafka, Schema Registry, Debezium
    resource_quota:
      requests.cpu: "6"
      requests.memory: "12Gi"
      limits.cpu: "12"
      limits.memory: "24Gi"

  # --- Governance ---
  - name: mfi-governance
    description: Vault, OpenMetadata, OPA, Audit
    resource_quota:
      requests.cpu: "4"
      requests.memory: "8Gi"
      limits.cpu: "8"
      limits.memory: "16Gi"

  # --- Security ---
  - name: istio-system
    description: Istio service mesh control plane

  # --- Observability ---
  - name: mfi-monitoring
    description: Prometheus, Grafana, Loki, Tempo, Alertmanager
    resource_quota:
      requests.cpu: "4"
      requests.memory: "8Gi"
      limits.cpu: "8"
      limits.memory: "16Gi"

  # --- Ingress ---
  - name: ingress-nginx
    description: NGINX Ingress Controller

  # --- Certificate Management ---
  - name: cert-manager
    description: Let's Encrypt certificate automation

  # --- GitOps ---
  - name: argocd
    description: ArgoCD GitOps controller
```

### Network Policies

Every namespace has a default-deny ingress policy. Allowed traffic is explicitly defined:

```yaml
# Default deny all ingress in every namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
spec:
  podSelector: {}
  policyTypes:
    - Ingress

# Example: mfi-app can reach mfi-data, mfi-streaming, mfi-governance
# mfi-data cannot reach mfi-app (databases don't call applications)
```

| Source Namespace | Destination Namespace | Allowed |
|------------------|-----------------------|---------|
| `ingress-nginx`  | `mfi-app`             | Yes     |
| `mfi-app`        | `mfi-data`            | Yes     |
| `mfi-app`        | `mfi-streaming`       | Yes     |
| `mfi-app`        | `mfi-governance`      | Yes     |
| `mfi-streaming`  | `mfi-data`            | Yes (Kafka consumers → ClickHouse) |
| `mfi-streaming`  | `mfi-app`             | No (push model, apps consume Kafka) |
| `mfi-monitoring` | ALL                   | Yes (scrape metrics) |
| ALL              | `mfi-governance`      | Yes (Vault, OPA checks) |
| `mfi-data`       | `mfi-data`            | Yes (internal replication) |

---

## Core Infrastructure

### 1. Ingress Controller - NGINX

```yaml
component: ingress-nginx
namespace: ingress-nginx
install_method: helm
chart: ingress-nginx/ingress-nginx
version: "4.10.x"

config:
  controller:
    replicaCount: 2
    nodeSelector:
      node-pool: system
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 500m
        memory: 512Mi
    config:
      use-forwarded-headers: "true"
      proxy-body-size: "500m"        # Large file uploads
      proxy-read-timeout: "300"       # Long-running AI requests
      proxy-send-timeout: "300"
      ssl-protocols: "TLSv1.2 TLSv1.3"
      ssl-ciphers: "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256"
    metrics:
      enabled: true
      serviceMonitor:
        enabled: true
```

### 2. Certificate Manager

```yaml
component: cert-manager
namespace: cert-manager
install_method: helm
chart: jetstack/cert-manager
version: "1.14.x"

config:
  installCRDs: true
  
cluster_issuers:
  - name: letsencrypt-prod
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ops@mfiinsights.com
    solver: dns01  # Or http01
```

### 3. Istio Service Mesh

```yaml
component: istio
namespace: istio-system
install_method: istioctl
version: "1.21.x"

config:
  profile: default
  meshConfig:
    accessLogFile: /dev/stdout
    enableAutoMtls: true           # Automatic mTLS between all services
    defaultConfig:
      tracing:
        zipkin:
          address: tempo.mfi-monitoring:9411
  
  # Strict mTLS - no plaintext traffic inside mesh
  peerAuthentication:
    mtls:
      mode: STRICT
```

---

## Data Tier

### 4. PostgreSQL (CloudNativePG)

**Purpose:** Transactional data - tenants, users, upload metadata, schema mappings, chat history, audit references, consent records.

```yaml
component: postgresql
namespace: mfi-data
install_method: operator
operator: cloudnative-pg/cloudnative-pg
operator_version: "1.23.x"

cluster:
  name: mfi-postgres
  instances: 3                      # 1 primary + 2 replicas
  
  postgresql:
    parameters:
      max_connections: "200"
      shared_buffers: "2GB"
      effective_cache_size: "6GB"
      work_mem: "64MB"
      maintenance_work_mem: "512MB"
      wal_level: logical             # Required for Debezium CDC
      max_wal_senders: "10"
      max_replication_slots: "10"
    
    pg_hba:
      - host all all 10.0.0.0/8 scram-sha-256  # Internal cluster only

  storage:
    size: 100Gi
    storageClass: gp3-encrypted     # Encrypted EBS volumes

  resources:
    requests:
      cpu: "1"
      memory: 4Gi
    limits:
      cpu: "2"
      memory: 8Gi

  nodeSelector:
    node-pool: data

  backup:
    barmanObjectStore:
      destinationPath: s3://mfi-backups/postgres/
      wal:
        compression: gzip
      data:
        compression: gzip
    retentionPolicy: "30d"

  monitoring:
    enablePodMonitor: true

  # Row Level Security is enforced at the application/migration level
  # See: prisma/migrations/*_enable_rls.sql
```

**Required Extensions:**
```
pgcrypto          # Field-level encryption functions
pg_stat_statements # Query performance monitoring
pg_trgm           # Fuzzy text search
```

### 5. ClickHouse (Altinity Operator)

**Purpose:** Analytical data - normalized loan records, repayment data, KPI aggregations, audit logs. This is the core analytical engine.

```yaml
component: clickhouse
namespace: mfi-data
install_method: operator
operator: altinity/clickhouse-operator
operator_version: "0.23.x"

cluster:
  name: mfi-clickhouse
  
  configuration:
    clusters:
      - name: mfi
        layout:
          shardsCount: 2            # 2 shards for horizontal scaling
          replicasCount: 2          # 2 replicas per shard for HA
    
    settings:
      max_memory_usage: "10000000000"           # 10GB per query
      max_memory_usage_for_all_queries: "20000000000"  # 20GB total
      max_execution_time: 300                     # 5 min max query time
      max_rows_to_read: 1000000000               # 1B rows max per query
      readonly: 0
    
    profiles:
      readonly:
        readonly: 1                  # Read-only profile for query-service
      
    users:
      app:
        password_sha256_hex: "<generated>"
        profile: default
        quota: default
        networks:
          ip:
            - "10.0.0.0/8"          # Internal cluster only
      
      query_reader:
        password_sha256_hex: "<generated>"
        profile: readonly
        quota: default
    
    # Quotas to prevent runaway queries
    quotas:
      default:
        interval:
          - duration: 3600
            queries: 1000
            result_rows: 100000000

  templates:
    podTemplates:
      - name: clickhouse-pod
        spec:
          nodeSelector:
            node-pool: data
          containers:
            - name: clickhouse
              resources:
                requests:
                  cpu: "2"
                  memory: 8Gi
                limits:
                  cpu: "4"
                  memory: 16Gi
    
    volumeClaimTemplates:
      - name: data
        spec:
          storageClassName: gp3-encrypted
          resources:
            requests:
              storage: 500Gi

# --- Core Tables (applied via migrations) ---
tables:
  # Normalized loan data from all MFIs
  - name: loan_data
    engine: ReplicatedMergeTree
    partition_by: toYYYYMM(disbursement_date)
    order_by: (tenant_id, loan_account_no, disbursement_date)
    ttl: disbursement_date + INTERVAL 10 YEAR
    row_policy: "tenant_isolation: tenant_id = currentUser()"
    columns:
      - tenant_id              String
      - upload_id              String
      - loan_account_no        String
      - client_id              String
      - client_name_hash       String        # Hashed PII
      - branch_id              Nullable(String)
      - branch_name            Nullable(String)
      - loan_product           String
      - loan_purpose           Nullable(String)
      - principal_amount       Decimal(18,2)
      - disbursement_date      Date
      - maturity_date          Nullable(Date)
      - interest_rate          Decimal(8,4)
      - loan_term_months       UInt16
      - repayment_frequency    LowCardinality(String)
      - outstanding_principal  Decimal(18,2)
      - outstanding_interest   Decimal(18,2)
      - outstanding_total      Decimal(18,2)
      - arrears_amount         Decimal(18,2)
      - arrears_days           UInt32
      - loan_status            LowCardinality(String)
      - currency               LowCardinality(String)
      - last_payment_date      Nullable(Date)
      - last_payment_amount    Nullable(Decimal(18,2))
      - collateral_type        Nullable(String)
      - collateral_value       Nullable(Decimal(18,2))
      - write_off_amount       Nullable(Decimal(18,2))
      - write_off_date         Nullable(Date)
      - data_quality_score     UInt8
      - ingested_at            DateTime DEFAULT now()
  
  # Repayment schedule and history
  - name: repayment_data
    engine: ReplicatedMergeTree
    partition_by: toYYYYMM(due_date)
    order_by: (tenant_id, loan_account_no, due_date)
    columns:
      - tenant_id              String
      - loan_account_no        String
      - installment_number     UInt16
      - due_date               Date
      - principal_due          Decimal(18,2)
      - interest_due           Decimal(18,2)
      - fees_due               Decimal(18,2)
      - total_due              Decimal(18,2)
      - principal_paid         Decimal(18,2)
      - interest_paid          Decimal(18,2)
      - fees_paid              Decimal(18,2)
      - total_paid             Decimal(18,2)
      - payment_date           Nullable(Date)
      - days_late              Int32
      - status                 LowCardinality(String)
      - ingested_at            DateTime DEFAULT now()

  # Immutable audit log
  - name: audit_log
    engine: ReplicatedMergeTree
    partition_by: toYYYYMM(timestamp)
    order_by: (tenant_id, timestamp, event_id)
    ttl: timestamp + INTERVAL 7 YEAR
    settings:
      allow_nullable_key: 0
    columns:
      - event_id               String
      - timestamp              DateTime64(3)
      - tenant_id              String
      - user_id                String
      - action                 LowCardinality(String)
      - resource               String
      - resource_id            String
      - details                String
      - ip_address             String
      - user_agent             String
      - outcome                LowCardinality(String)
  
  # Pre-aggregated KPI materialized views
  - name: portfolio_kpis_daily
    engine: ReplicatedSummingMergeTree
    partition_by: toYYYYMM(report_date)
    order_by: (tenant_id, report_date, branch_name, loan_product)
    source: "MATERIALIZED VIEW from loan_data"
    columns:
      - tenant_id              String
      - report_date            Date
      - branch_name            String
      - loan_product           String
      - total_loans            UInt64
      - total_disbursed        Decimal(18,2)
      - total_outstanding      Decimal(18,2)
      - par_1_amount           Decimal(18,2)   # Portfolio at Risk > 1 day
      - par_30_amount          Decimal(18,2)   # Portfolio at Risk > 30 days
      - par_60_amount          Decimal(18,2)
      - par_90_amount          Decimal(18,2)
      - write_off_amount       Decimal(18,2)
      - active_clients         UInt64
      - new_disbursements      UInt64
      - collection_amount      Decimal(18,2)
```

### 6. MinIO (Object Storage)

**Purpose:** Raw file storage (uploaded CSV, XLSX, PDF files), processed exports, report PDFs.

```yaml
component: minio
namespace: mfi-data
install_method: helm
chart: minio/minio
version: "5.2.x"

config:
  mode: distributed
  replicas: 4
  
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: "1"
      memory: 2Gi

  persistence:
    enabled: true
    size: 500Gi
    storageClass: gp3-encrypted

  nodeSelector:
    node-pool: data

  # Server-Side Encryption
  environment:
    MINIO_KMS_KES_ENDPOINT: https://vault.mfi-governance:7373
    MINIO_KMS_KES_KEY_NAME: minio-encryption-key

buckets:
  - name: mfi-raw-uploads
    policy: none                     # No public access
    lifecycle:
      - prefix: ""
        expiry_days: 730             # 2 year retention on raw files
    versioning: true
  
  - name: mfi-processed
    policy: none
    lifecycle:
      - prefix: ""
        expiry_days: 1825            # 5 year retention
  
  - name: mfi-exports
    policy: none
    lifecycle:
      - prefix: ""
        expiry_days: 90              # 90 day retention on exports

# Bucket naming convention: {bucket}/{tenant_id}/{upload_id}/{filename}
# IAM policies enforce tenant-scoped access
```

### 7. Redis (Sentinel)

**Purpose:** Caching (dashboard queries, session data), BullMQ job queues for async processing, rate limiting.

```yaml
component: redis
namespace: mfi-data
install_method: helm
chart: bitnami/redis
version: "19.x"

config:
  architecture: replication
  
  master:
    resources:
      requests:
        cpu: 250m
        memory: 512Mi
      limits:
        cpu: 500m
        memory: 1Gi
    persistence:
      size: 10Gi
      storageClass: gp3-encrypted
    nodeSelector:
      node-pool: data

  replica:
    replicaCount: 2
    resources:
      requests:
        cpu: 250m
        memory: 512Mi
      limits:
        cpu: 500m
        memory: 1Gi

  sentinel:
    enabled: true
    resources:
      requests:
        cpu: 100m
        memory: 128Mi

  auth:
    enabled: true
    existingSecret: redis-credentials   # Stored in Vault

  metrics:
    enabled: true
    serviceMonitor:
      enabled: true

  # Redis maxmemory policy
  commonConfiguration: |-
    maxmemory 768mb
    maxmemory-policy allkeys-lru
    timeout 300
```

---

## Messaging & Streaming

### 8. Kafka (Strimzi)

**Purpose:** Central event bus for all data movement. File upload events, parsed records, CDC events, audit events, insight generation triggers.

```yaml
component: kafka
namespace: mfi-streaming
install_method: operator
operator: strimzi/strimzi-kafka-operator
operator_version: "0.40.x"

cluster:
  name: mfi-kafka
  version: "3.7.0"
  
  kafka:
    replicas: 3
    
    listeners:
      - name: internal
        port: 9092
        type: internal
        tls: true                    # TLS on all internal traffic
      - name: tls
        port: 9093
        type: internal
        tls: true
        authentication:
          type: scram-sha-512        # SASL authentication
    
    config:
      offsets.topic.replication.factor: 3
      transaction.state.log.replication.factor: 3
      transaction.state.log.min.isr: 2
      default.replication.factor: 3
      min.insync.replicas: 2
      log.retention.hours: 168       # 7 days default retention
      log.retention.bytes: -1        # No size limit
      auto.create.topics.enable: false  # Explicit topic creation only
      message.max.bytes: 10485760    # 10MB max message (for large batches)
    
    storage:
      type: persistent-claim
      size: 200Gi
      class: gp3-encrypted
    
    resources:
      requests:
        cpu: "1"
        memory: 4Gi
      limits:
        cpu: "2"
        memory: 8Gi
    
    template:
      pod:
        affinity:
          podAntiAffinity:
            requiredDuringSchedulingIgnoredDuringExecution:
              - labelSelector:
                  matchLabels:
                    strimzi.io/name: mfi-kafka-kafka
                topologyKey: kubernetes.io/hostname
        nodeSelector:
          node-pool: data
    
    metricsConfig:
      type: jmxPrometheusExporter
      valueFrom:
        configMapKeyRef:
          name: kafka-metrics
          key: kafka-metrics-config.yml

  zookeeper:
    replicas: 3
    storage:
      type: persistent-claim
      size: 20Gi
      class: gp3-encrypted
    resources:
      requests:
        cpu: 250m
        memory: 1Gi
      limits:
        cpu: 500m
        memory: 2Gi

# --- Topics ---
topics:
  # File upload lifecycle
  - name: platform.uploads.created
    partitions: 6
    replicas: 3
    config:
      retention.ms: "604800000"      # 7 days
      cleanup.policy: delete
    description: "Triggered when a file is uploaded to MinIO"

  - name: platform.uploads.parsed
    partitions: 12
    replicas: 3
    config:
      retention.ms: "604800000"
      max.message.bytes: "10485760"  # 10MB - parsed records batch
    description: "Parsed and normalized records from uploaded files"

  - name: platform.uploads.failed
    partitions: 3
    replicas: 3
    config:
      retention.ms: "2592000000"     # 30 days - keep failures longer
    description: "Failed upload processing events (DLQ)"

  # Schema detection
  - name: platform.schema.detected
    partitions: 6
    replicas: 3
    config:
      retention.ms: "604800000"
    description: "AI-detected schema mapping results"

  - name: platform.schema.confirmed
    partitions: 6
    replicas: 3
    config:
      retention.ms: "604800000"
    description: "User-confirmed schema mappings"

  # Normalized data
  - name: platform.data.normalized
    partitions: 12
    replicas: 3
    config:
      retention.ms: "604800000"
      max.message.bytes: "10485760"
    description: "Normalized loan/repayment records ready for ClickHouse"

  # Insights
  - name: platform.insights.requested
    partitions: 6
    replicas: 3
    config:
      retention.ms: "604800000"
    description: "Requests for AI insight generation"

  - name: platform.insights.generated
    partitions: 6
    replicas: 3
    config:
      retention.ms: "604800000"
    description: "Completed AI insights"

  # Audit (immutable, long retention)
  - name: platform.audit.events
    partitions: 12
    replicas: 3
    config:
      retention.ms: "220752000000"   # 7 years
      cleanup.policy: delete
      min.insync.replicas: "2"
    description: "Immutable audit trail - ALL data access and mutations"

  # CDC topics (created by Debezium, prefixed per tenant)
  # Pattern: cdc.{tenant_id}.{source_db}.{table_name}
  # Example: cdc.tenant-abc.fineract.m_loan

  # Notifications
  - name: platform.notifications
    partitions: 6
    replicas: 3
    config:
      retention.ms: "86400000"       # 1 day
    description: "User-facing notifications (upload complete, insights ready)"

# --- Kafka Users (SCRAM-SHA-512) ---
users:
  - name: app-producer
    authentication:
      type: scram-sha-512
    authorization:
      type: simple
      acls:
        - resource:
            type: topic
            name: "platform."
            patternType: prefix
          operations: [Write, Describe]

  - name: ingestion-consumer
    authentication:
      type: scram-sha-512
    authorization:
      type: simple
      acls:
        - resource:
            type: topic
            name: "platform.uploads."
            patternType: prefix
          operations: [Read, Describe]
        - resource:
            type: topic
            name: "platform.data."
            patternType: prefix
          operations: [Read, Write, Describe]
        - resource:
            type: group
            name: "ingestion-"
            patternType: prefix
          operations: [Read]

  - name: ai-consumer
    authentication:
      type: scram-sha-512
    authorization:
      type: simple
      acls:
        - resource:
            type: topic
            name: "platform.schema."
            patternType: prefix
          operations: [Read, Write, Describe]
        - resource:
            type: topic
            name: "platform.insights."
            patternType: prefix
          operations: [Read, Write, Describe]
        - resource:
            type: group
            name: "ai-"
            patternType: prefix
          operations: [Read]

  - name: audit-consumer
    authentication:
      type: scram-sha-512
    authorization:
      type: simple
      acls:
        - resource:
            type: topic
            name: "platform.audit.events"
            patternType: literal
          operations: [Read, Describe]
        - resource:
            type: group
            name: "audit-"
            patternType: prefix
          operations: [Read]
```

### 9. Schema Registry (Apicurio)

```yaml
component: schema-registry
namespace: mfi-streaming
install_method: helm
chart: apicurio/apicurio-registry
version: "2.6.x"

config:
  persistence:
    type: kafkasql                   # Store schemas in Kafka itself
    kafkaBootstrapServers: mfi-kafka-kafka-bootstrap:9092
  
  resources:
    requests:
      cpu: 250m
      memory: 512Mi
    limits:
      cpu: 500m
      memory: 1Gi

# Schemas enforce the canonical MFI data format:
# - All producers must serialize against registered schemas
# - Schema evolution rules: BACKWARD compatible only
# - Breaking changes require new topic version
```

### 10. Debezium (Phase 2)

```yaml
component: debezium
namespace: mfi-streaming
install_method: strimzi-kafka-connect
phase: 2                             # Not in initial deployment
depends_on: [kafka, schema-registry]

description: |
  CDC connectors for MFIs that want direct database synchronization.
  Each MFI gets a separate connector instance with its own credentials.
  Connectors read from MFI source databases and produce to tenant-specific
  Kafka topics.

kafka_connect:
  name: mfi-debezium
  replicas: 2
  
  config:
    group.id: debezium-cluster
    config.storage.topic: debezium-configs
    offset.storage.topic: debezium-offsets
    status.storage.topic: debezium-status
    key.converter: io.apicurio.registry.serde.avro.AvroKafkaSerializer
    value.converter: io.apicurio.registry.serde.avro.AvroKafkaSerializer
  
  build:
    plugins:
      - name: debezium-postgres
        artifacts:
          - type: maven
            group: io.debezium
            artifact: debezium-connector-postgres
            version: "2.6.0.Final"
      - name: debezium-mysql
        artifacts:
          - type: maven
            group: io.debezium
            artifact: debezium-connector-mysql
            version: "2.6.0.Final"

# Connector template (created per-tenant via API):
# POST /connectors
# {
#   "name": "cdc-{tenant_id}-fineract",
#   "config": {
#     "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
#     "database.hostname": "{mfi_db_host}",
#     "database.port": "5432",
#     "database.user": "{encrypted_in_vault}",
#     "database.password": "{encrypted_in_vault}",
#     "database.dbname": "fineract",
#     "topic.prefix": "cdc.{tenant_id}",
#     "schema.include.list": "public",
#     "table.include.list": "m_loan,m_client,m_loan_repayment_schedule,m_loan_transaction",
#     "slot.name": "debezium_{tenant_id}",
#     "plugin.name": "pgoutput",
#     "transforms": "tenantId",
#     "transforms.tenantId.type": "org.apache.kafka.connect.transforms.InsertField$Value",
#     "transforms.tenantId.static.field": "tenant_id",
#     "transforms.tenantId.static.value": "{tenant_id}"
#   }
# }
```

---

## Application Tier

### 11. Web Application (Next.js)

```yaml
component: web
namespace: mfi-app
image: ghcr.io/mfi-insights/web
port: 3000

deployment:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0

  resources:
    requests:
      cpu: 250m
      memory: 512Mi
    limits:
      cpu: "1"
      memory: 1Gi

  nodeSelector:
    node-pool: app

  env_from_secrets:
    - DATABASE_URL                   # PostgreSQL connection string
    - NEXTAUTH_SECRET
    - OPENAI_API_KEY                 # From Vault
  
  env_from_configmap:
    - NEXT_PUBLIC_APP_URL
    - CLICKHOUSE_HOST
    - KAFKA_BROKERS
    - MINIO_ENDPOINT
    - REDIS_URL
    - SCHEMA_REGISTRY_URL
    - VAULT_ADDR
    - OPENMETADATA_URL

  probes:
    liveness:
      httpGet:
        path: /api/health
        port: 3000
      initialDelaySeconds: 10
      periodSeconds: 30
    readiness:
      httpGet:
        path: /api/health
        port: 3000
      initialDelaySeconds: 5
      periodSeconds: 10

  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilization: 70
    targetMemoryUtilization: 80

ingress:
  host: app.mfiinsights.com
  tls: true
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-body-size: "500m"
```

### 12. Ingestion Worker

```yaml
component: ingestion-worker
namespace: mfi-app
image: ghcr.io/mfi-insights/ingestion-worker
type: consumer                       # Long-running Kafka consumer, not HTTP

description: |
  Consumes from Kafka upload topics.
  Responsibilities:
    1. Download raw file from MinIO
    2. Parse file (CSV, XLSX, JSON, PDF)
    3. Apply confirmed schema mapping (or request AI detection)
    4. Validate data quality
    5. Produce normalized records to platform.data.normalized
    6. Trigger insight generation

deployment:
  replicas: 3
  strategy:
    type: RollingUpdate

  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: "2"
      memory: 4Gi                    # Needs memory for large file parsing

  nodeSelector:
    node-pool: app

  env:
    KAFKA_GROUP_ID: ingestion-main
    KAFKA_TOPICS: platform.uploads.created,platform.schema.confirmed
    CLICKHOUSE_HOST: mfi-clickhouse.mfi-data
    MINIO_ENDPOINT: minio.mfi-data:9000
    
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 8
    # Scale based on Kafka consumer lag
    triggers:
      - type: kafka
        metadata:
          bootstrapServers: mfi-kafka-kafka-bootstrap.mfi-streaming:9092
          consumerGroup: ingestion-main
          topic: platform.uploads.created
          lagThreshold: "50"
```

### 13. AI Worker

```yaml
component: ai-worker
namespace: mfi-app
image: ghcr.io/mfi-insights/ai-worker
type: consumer

description: |
  Handles all AI/ML workloads:
    1. Schema detection (analyze uploaded data, detect column meanings)
    2. Insight generation (analyze normalized data, produce KPI narratives)
    3. Anomaly detection (flag unusual patterns)
    4. NL-to-SQL translation (for conversational analytics)
  
  All PII is stripped before sending to OpenAI.
  Every AI call is logged to the audit trail.

deployment:
  replicas: 2
  strategy:
    type: RollingUpdate

  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: "2"
      memory: 2Gi

  nodeSelector:
    node-pool: ai-workers

  env:
    KAFKA_GROUP_ID: ai-main
    KAFKA_TOPICS: platform.schema.detected,platform.insights.requested
    OPENAI_MODEL: gpt-4o
    OPENAI_MAX_TOKENS: "4096"
    ANONYMIZE_PII: "true"            # MUST be true in production

  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 6
    triggers:
      - type: kafka
        metadata:
          consumerGroup: ai-main
          topic: platform.insights.requested
          lagThreshold: "20"
```

### 14. Query Service

```yaml
component: query-service
namespace: mfi-app
image: ghcr.io/mfi-insights/query-service
port: 8080

description: |
  Serves analytical queries to the frontend.
  Translates dashboard requests into ClickHouse queries.
  Enforces tenant isolation on every query.
  Handles NL-to-SQL for conversational analytics.

deployment:
  replicas: 2
  resources:
    requests:
      cpu: 250m
      memory: 512Mi
    limits:
      cpu: "1"
      memory: 1Gi

  nodeSelector:
    node-pool: app

  env:
    CLICKHOUSE_HOST: mfi-clickhouse.mfi-data
    CLICKHOUSE_USER: query_reader     # Read-only ClickHouse user
    REDIS_URL: redis-sentinel.mfi-data:26379
    CACHE_TTL_SECONDS: "300"          # 5 min cache on dashboard queries

  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 6
    targetCPUUtilization: 70
```

---

## Data Governance

### 15. HashiCorp Vault

```yaml
component: vault
namespace: mfi-governance
install_method: helm
chart: hashicorp/vault
version: "0.28.x"

config:
  server:
    ha:
      enabled: true
      replicas: 3
      raft:
        enabled: true
        config: |
          storage "raft" {
            path = "/vault/data"
          }
    
    resources:
      requests:
        cpu: 250m
        memory: 256Mi
      limits:
        cpu: 500m
        memory: 512Mi
    
    dataStorage:
      size: 10Gi
      storageClass: gp3-encrypted

    nodeSelector:
      node-pool: system

    auditStorage:
      enabled: true
      size: 10Gi

  # Vault auth method for K8s service accounts
  auth:
    kubernetes:
      enabled: true

# --- Secret Engines ---
secret_engines:
  # Per-tenant encryption keys
  - path: secret/tenants
    type: kv-v2
    description: "Tenant-specific secrets (encryption keys, API credentials)"
    # Structure: secret/tenants/{tenant_id}/encryption-key
    #            secret/tenants/{tenant_id}/db-credentials

  # Database credentials (dynamic)
  - path: database
    type: database
    description: "Dynamic database credentials with TTL"
    connections:
      - name: postgres
        plugin: postgresql-database-plugin
        connection_url: "postgresql://{{username}}:{{password}}@mfi-postgres-rw.mfi-data:5432/mfi"
      - name: clickhouse
        plugin: clickhouse-database-plugin
        connection_url: "clickhouse://{{username}}:{{password}}@mfi-clickhouse.mfi-data:8123"

  # Transit engine for field-level encryption
  - path: transit
    type: transit
    description: "Encryption as a service - field-level encryption without exposing keys"
    keys:
      - name: pii-encryption
        type: aes256-gcm96
        auto_rotate_period: "720h"   # Rotate every 30 days

# --- Vault Policies ---
policies:
  - name: app-read
    rules: |
      path "secret/data/tenants/*" {
        capabilities = ["read"]
      }
      path "transit/encrypt/pii-encryption" {
        capabilities = ["update"]
      }
      path "transit/decrypt/pii-encryption" {
        capabilities = ["update"]
      }
      path "database/creds/app-role" {
        capabilities = ["read"]
      }

  - name: admin
    rules: |
      path "secret/*" {
        capabilities = ["create", "read", "update", "delete", "list"]
      }
      path "transit/*" {
        capabilities = ["create", "read", "update", "delete", "list"]
      }
```

### 16. Open Policy Agent (OPA / Gatekeeper)

```yaml
component: opa-gatekeeper
namespace: mfi-governance
install_method: helm
chart: gatekeeper/gatekeeper
version: "3.16.x"

description: |
  Enforces policies across the cluster:
  - All pods must have resource limits
  - No containers run as root
  - All images must come from approved registries
  - No privileged containers
  - All pods must have network policies

constraints:
  # No containers running as root
  - name: no-root-containers
    kind: K8sPSPPrivilegedContainer
    match:
      kinds:
        - apiGroups: [""]
          kinds: ["Pod"]

  # All containers must have resource limits
  - name: require-resource-limits
    kind: K8sRequiredResources
    parameters:
      limits: ["cpu", "memory"]
      requests: ["cpu", "memory"]

  # Images must come from approved registries
  - name: approved-registries
    kind: K8sAllowedRepos
    parameters:
      repos:
        - "ghcr.io/mfi-insights/"
        - "docker.io/bitnami/"
        - "docker.io/strimzi/"
        - "quay.io/"
        - "registry.k8s.io/"

  # All namespaces must have network policies
  - name: require-network-policy
    kind: K8sRequireNetworkPolicy
```

### 17. OpenMetadata (Data Catalog)

```yaml
component: openmetadata
namespace: mfi-governance
install_method: helm
chart: open-metadata/openmetadata
version: "1.4.x"
phase: 2                             # Deploy after core data tier is stable

description: |
  Data catalog and lineage tracking.
  Automatically discovers and classifies all data in:
  - PostgreSQL (metadata tables)
  - ClickHouse (analytical tables)
  - Kafka topics
  
  Provides:
  - Automatic PII detection and tagging
  - Data lineage (file upload → Kafka → ClickHouse → dashboard)
  - Data quality dashboards
  - Searchable data catalog for the team

config:
  dependencies:
    database:
      host: mfi-postgres-rw.mfi-data
      port: 5432
      databaseName: openmetadata
    elasticsearch:
      host: elasticsearch.mfi-governance
      port: 9200

ingestion_connectors:
  - type: postgres
    config:
      hostPort: mfi-postgres-rw.mfi-data:5432
      database: mfi
      
  - type: clickhouse
    config:
      hostPort: mfi-clickhouse.mfi-data:8123
      database: default
      
  - type: kafka
    config:
      bootstrapServers: mfi-kafka-kafka-bootstrap.mfi-streaming:9092
      schemaRegistryURL: http://schema-registry.mfi-streaming:8080
```

---

## Security

### 18. Security Hardening

```yaml
security:

  # --- Pod Security Standards ---
  pod_security:
    enforce: restricted              # K8s Pod Security Standards
    exceptions:
      - namespace: istio-system      # Istio needs NET_ADMIN
      - namespace: mfi-monitoring    # Prometheus needs host network for node metrics

  # --- Image Security ---
  image_scanning:
    tool: trivy
    scan_on: push                    # Scan images in CI before they reach the cluster
    severity_threshold: HIGH         # Block HIGH and CRITICAL vulnerabilities
    
  # --- Runtime Security ---
  runtime_monitoring:
    tool: falco
    namespace: mfi-monitoring
    rules:
      - name: detect-shell-in-container
        description: Alert when shell is spawned in any app container
      - name: detect-sensitive-file-read
        description: Alert on reads to /etc/shadow, /etc/passwd
      - name: detect-outbound-connections
        description: Alert on unexpected outbound connections from data tier

  # --- Secret Management ---
  secrets:
    provider: vault
    injection_method: vault-agent-injector
    rotation_period: 30d
    # NEVER store secrets in K8s secrets directly
    # All secrets are injected from Vault at runtime

  # --- RBAC ---
  rbac:
    cluster_roles:
      - name: mfi-developer
        rules:
          - apiGroups: [""]
            resources: ["pods", "services", "configmaps"]
            verbs: ["get", "list", "watch"]
            namespaces: ["mfi-app"]
          - apiGroups: [""]
            resources: ["pods/log"]
            verbs: ["get"]
            namespaces: ["mfi-app"]
      
      - name: mfi-operator
        rules:
          - apiGroups: ["*"]
            resources: ["*"]
            verbs: ["*"]
            namespaces: ["mfi-app", "mfi-data", "mfi-streaming"]
      
      - name: mfi-readonly
        rules:
          - apiGroups: [""]
            resources: ["*"]
            verbs: ["get", "list", "watch"]
```

---

## Observability

### 19. Monitoring Stack

```yaml
component: kube-prometheus-stack
namespace: mfi-monitoring
install_method: helm
chart: prometheus-community/kube-prometheus-stack
version: "58.x"

config:
  prometheus:
    retention: 30d
    storage:
      volumeClaimTemplate:
        spec:
          storageClassName: gp3-encrypted
          resources:
            requests:
              storage: 100Gi
    resources:
      requests:
        cpu: 500m
        memory: 2Gi
      limits:
        cpu: "1"
        memory: 4Gi

  alertmanager:
    config:
      receivers:
        - name: slack-critical
          slack_configs:
            - channel: "#mfi-alerts-critical"
              send_resolved: true
        - name: slack-warning
          slack_configs:
            - channel: "#mfi-alerts-warning"
              send_resolved: true
        - name: pagerduty
          pagerduty_configs:
            - service_key: "<from-vault>"
      
      route:
        group_by: [alertname, namespace]
        group_wait: 30s
        group_interval: 5m
        repeat_interval: 4h
        receiver: slack-warning
        routes:
          - match:
              severity: critical
            receiver: pagerduty
          - match:
              severity: critical
            receiver: slack-critical

  grafana:
    enabled: true
    persistence:
      enabled: true
      size: 10Gi
    
    dashboards:
      # Auto-provisioned dashboards
      - name: mfi-platform-overview
        description: High-level platform health
      - name: mfi-kafka-lag
        description: Kafka consumer lag per consumer group
      - name: mfi-clickhouse-queries
        description: ClickHouse query performance
      - name: mfi-upload-pipeline
        description: File upload processing metrics
      - name: mfi-ai-worker
        description: AI worker performance and costs
      - name: mfi-tenant-usage
        description: Per-tenant resource usage

# --- Custom Alerts ---
alerts:
  # Data pipeline health
  - name: KafkaConsumerLagHigh
    expr: kafka_consumergroup_lag_sum > 1000
    for: 5m
    severity: warning
    summary: "Kafka consumer lag is high ({{ $value }} messages behind)"

  - name: KafkaConsumerLagCritical
    expr: kafka_consumergroup_lag_sum > 10000
    for: 2m
    severity: critical
    summary: "Kafka consumer lag is critical - data pipeline may be stalled"

  - name: ClickHouseQuerySlow
    expr: clickhouse_query_duration_ms{quantile="0.99"} > 30000
    for: 5m
    severity: warning
    summary: "ClickHouse P99 query time exceeds 30 seconds"

  - name: UploadProcessingFailed
    expr: rate(upload_processing_errors_total[5m]) > 0.1
    for: 2m
    severity: warning
    summary: "Upload processing error rate is elevated"

  - name: AIWorkerErrorRate
    expr: rate(ai_worker_errors_total[5m]) / rate(ai_worker_requests_total[5m]) > 0.05
    for: 5m
    severity: warning
    summary: "AI worker error rate exceeds 5%"

  - name: TenantDataIsolationViolation
    expr: tenant_cross_access_attempts_total > 0
    for: 0m
    severity: critical
    summary: "CRITICAL: Potential tenant data isolation violation detected"

  # Infrastructure health
  - name: PostgreSQLReplicationLag
    expr: pg_replication_lag > 30
    for: 5m
    severity: warning
    summary: "PostgreSQL replication lag exceeds 30 seconds"

  - name: DiskSpaceRunningLow
    expr: kubelet_volume_stats_available_bytes / kubelet_volume_stats_capacity_bytes < 0.15
    for: 10m
    severity: warning
    summary: "Disk space below 15% on {{ $labels.persistentvolumeclaim }}"

  - name: PodCrashLooping
    expr: rate(kube_pod_container_status_restarts_total[15m]) > 0.1
    for: 5m
    severity: critical
    summary: "Pod {{ $labels.pod }} is crash-looping"
```

### 20. Logging (Loki)

```yaml
component: loki
namespace: mfi-monitoring
install_method: helm
chart: grafana/loki-stack
version: "2.10.x"

config:
  loki:
    persistence:
      enabled: true
      size: 50Gi
    retention_period: 30d
  
  promtail:
    enabled: true
    # Collect logs from all namespaces
    # Automatically label by namespace, pod, container

# Log retention by namespace:
# mfi-app: 30 days
# mfi-data: 90 days
# mfi-governance: 365 days (audit-related logs)
# mfi-streaming: 30 days
```

### 21. Tracing (Tempo)

```yaml
component: tempo
namespace: mfi-monitoring
install_method: helm
chart: grafana/tempo
version: "1.9.x"
phase: 2

config:
  persistence:
    enabled: true
    size: 50Gi
  
  # Trace the full request path:
  # Frontend → API → Kafka → Ingestion Worker → ClickHouse
  # This helps debug "why is this upload taking so long?"
```

---

## GitOps Configuration

### 22. ArgoCD

```yaml
component: argocd
namespace: argocd
install_method: helm
chart: argo/argo-cd
version: "6.x"

config:
  server:
    ingress:
      enabled: true
      hosts:
        - argocd.mfiinsights.com
      tls: true

  # Repository connection
  repositories:
    - url: git@github.com:mfi-insights/platform-infra.git
      sshPrivateKeySecret:
        name: argocd-repo-key
        key: ssh-privatekey

# --- ArgoCD Applications ---
applications:
  # Phase 0: Cluster foundations
  - name: cert-manager
    source:
      path: infra/k8s/cert-manager
    destination:
      namespace: cert-manager
    syncPolicy:
      automated:
        prune: true
        selfHeal: true
    wave: "0"

  - name: istio
    source:
      path: infra/k8s/istio
    destination:
      namespace: istio-system
    wave: "0"

  # Phase 1: Storage
  - name: postgresql
    source:
      path: infra/k8s/postgres
    destination:
      namespace: mfi-data
    syncPolicy:
      automated:
        prune: false                 # Never auto-delete databases
        selfHeal: true
    wave: "1"

  - name: redis
    source:
      path: infra/k8s/redis
    destination:
      namespace: mfi-data
    wave: "1"

  - name: minio
    source:
      path: infra/k8s/minio
    destination:
      namespace: mfi-data
    wave: "1"

  - name: clickhouse
    source:
      path: infra/k8s/clickhouse
    destination:
      namespace: mfi-data
    syncPolicy:
      automated:
        prune: false
        selfHeal: true
    wave: "1"

  # Phase 2: Streaming
  - name: kafka
    source:
      path: infra/k8s/kafka
    destination:
      namespace: mfi-streaming
    wave: "2"

  - name: schema-registry
    source:
      path: infra/k8s/schema-registry
    destination:
      namespace: mfi-streaming
    wave: "2"

  # Phase 3: Governance
  - name: vault
    source:
      path: infra/k8s/vault
    destination:
      namespace: mfi-governance
    wave: "3"

  - name: opa-gatekeeper
    source:
      path: infra/k8s/opa
    destination:
      namespace: mfi-governance
    wave: "3"

  # Phase 4: Applications
  - name: web
    source:
      path: infra/k8s/apps/web
    destination:
      namespace: mfi-app
    syncPolicy:
      automated:
        prune: true
        selfHeal: true
    wave: "4"

  - name: ingestion-worker
    source:
      path: infra/k8s/apps/ingestion-worker
    destination:
      namespace: mfi-app
    wave: "4"

  - name: ai-worker
    source:
      path: infra/k8s/apps/ai-worker
    destination:
      namespace: mfi-app
    wave: "4"

  - name: query-service
    source:
      path: infra/k8s/apps/query-service
    destination:
      namespace: mfi-app
    wave: "4"

  # Phase 5: Observability
  - name: monitoring
    source:
      path: infra/k8s/monitoring
    destination:
      namespace: mfi-monitoring
    wave: "5"

  - name: loki
    source:
      path: infra/k8s/loki
    destination:
      namespace: mfi-monitoring
    wave: "5"

# --- Sync Waves (Deployment Order) ---
# Wave 0: Cluster foundations (cert-manager, istio, namespaces, network policies)
# Wave 1: Storage tier (PostgreSQL, ClickHouse, MinIO, Redis)
# Wave 2: Streaming tier (Kafka, Schema Registry)
# Wave 3: Governance tier (Vault, OPA)
# Wave 4: Application tier (web, workers, services)
# Wave 5: Observability (monitoring, logging, tracing)
```

---

## Deployment Order

This is the exact sequence the GitOps agent must follow for a fresh cluster build:

```
WAVE 0 - FOUNDATIONS (parallel)
  ├── Create namespaces + resource quotas + network policies
  ├── Deploy cert-manager + ClusterIssuers
  ├── Deploy Istio control plane
  ├── Deploy NGINX Ingress Controller
  └── Wait: all pods healthy, istiod ready

WAVE 1 - STORAGE (parallel within wave, after wave 0)
  ├── Deploy CloudNativePG operator → Create mfi-postgres cluster
  │     └── Wait: primary + 2 replicas ready, replication streaming
  ├── Deploy Altinity ClickHouse operator → Create mfi-clickhouse cluster
  │     └── Wait: all shards + replicas ready
  ├── Deploy MinIO
  │     └── Wait: all replicas ready, create buckets
  ├── Deploy Redis Sentinel
  │     └── Wait: master + replicas + sentinels ready
  └── Run database migrations (PostgreSQL schema, ClickHouse tables)

WAVE 2 - STREAMING (after wave 1)
  ├── Deploy Strimzi Kafka operator → Create mfi-kafka cluster
  │     └── Wait: all brokers ready, ISR complete
  ├── Create Kafka topics
  ├── Create Kafka users + ACLs
  ├── Deploy Schema Registry
  │     └── Wait: healthy, connected to Kafka
  └── Register initial Avro/JSON schemas

WAVE 3 - GOVERNANCE (after wave 1)
  ├── Deploy Vault
  │     ├── Initialize + unseal (manual or auto-unseal with KMS)
  │     ├── Enable K8s auth method
  │     ├── Create secret engines (kv-v2, transit, database)
  │     ├── Create policies
  │     └── Seed initial secrets (DB passwords, API keys)
  ├── Deploy OPA Gatekeeper
  │     └── Apply constraint templates + constraints
  └── Wait: Vault sealed status = false, OPA webhook ready

WAVE 4 - APPLICATIONS (after waves 2 + 3)
  ├── Deploy web (Next.js)
  │     └── Wait: health check passes, ingress routes traffic
  ├── Deploy ingestion-worker
  │     └── Wait: Kafka consumer group registered, consuming
  ├── Deploy ai-worker
  │     └── Wait: Kafka consumer group registered, consuming
  ├── Deploy query-service
  │     └── Wait: health check passes, ClickHouse connection verified
  └── Run smoke tests (upload test file, verify pipeline end-to-end)

WAVE 5 - OBSERVABILITY (after wave 4)
  ├── Deploy kube-prometheus-stack (Prometheus + Grafana + Alertmanager)
  │     └── Verify: all ServiceMonitors scraping, dashboards loaded
  ├── Deploy Loki + Promtail
  │     └── Verify: logs flowing from all namespaces
  ├── Configure alert routes (Slack, PagerDuty)
  └── Deploy Grafana dashboards (auto-provisioned)

POST-DEPLOYMENT VERIFICATION
  ├── All pods in Running state (kubectl get pods --all-namespaces)
  ├── No CrashLoopBackOff
  ├── Kafka: all topics created, ISR = replication factor
  ├── PostgreSQL: replication lag < 1s
  ├── ClickHouse: all replicas synced
  ├── Vault: sealed = false, all auth methods configured
  ├── Istio: mTLS enforced (no plaintext traffic)
  ├── Network policies: verified with netpol test pods
  ├── Ingress: TLS termination working, valid certs
  ├── End-to-end test: upload CSV → parse → normalize → ClickHouse → query
  └── Monitoring: all alerts in "inactive" state (no firing)
```

---

## Resource Budgets

### Total Cluster Resource Summary

| Namespace       | CPU Requests | CPU Limits | Memory Requests | Memory Limits |
|-----------------|-------------|------------|-----------------|---------------|
| `mfi-app`       | 4.5 cores   | 12 cores   | 7.5 Gi          | 18 Gi         |
| `mfi-data`      | 7 cores     | 14 cores   | 30 Gi           | 60 Gi         |
| `mfi-streaming` | 4 cores     | 8 cores    | 14 Gi           | 28 Gi         |
| `mfi-governance`| 1.5 cores   | 3 cores    | 3 Gi            | 6 Gi          |
| `mfi-monitoring`| 2 cores     | 4 cores    | 5 Gi            | 10 Gi         |
| `istio-system`  | 0.5 cores   | 1 core     | 1 Gi            | 2 Gi          |
| `ingress-nginx` | 0.2 cores   | 1 core     | 256 Mi          | 1 Gi          |
| **TOTAL**       | **~20 cores**| **~43 cores** | **~61 Gi**   | **~125 Gi**   |

### Estimated Monthly Cloud Cost (Production)

| Provider | Configuration | Est. Monthly Cost |
|----------|---------------|-------------------|
| AWS EKS  | 3x t3.large + 3x r6i.xlarge + 2x c6i.xlarge | ~$800-1,200 |
| GCP GKE  | 3x e2-standard-4 + 3x n2-highmem-4 + 2x c2-standard-4 | ~$700-1,100 |
| Azure AKS| 3x D4s_v5 + 3x E4s_v5 + 2x F4s_v2 | ~$750-1,150 |

*Costs include compute, storage (500GB SSD), and network. Excludes OpenAI API costs.*

---

## Disaster Recovery

### Backup Strategy

| Component   | Method                          | Frequency | Retention | RTO    | RPO    |
|-------------|--------------------------------|-----------|-----------|--------|--------|
| PostgreSQL  | CloudNativePG Barman → S3      | Continuous WAL + daily base | 30 days | 15 min | < 1 min |
| ClickHouse  | clickhouse-backup → S3         | Daily full + hourly incremental | 30 days | 1 hour | 1 hour |
| Kafka       | MirrorMaker 2 to DR cluster    | Continuous | N/A       | 5 min  | < 1 min |
| MinIO       | Bucket replication to DR region| Continuous | Same as source | 5 min | < 1 min |
| Vault       | Raft snapshots → S3            | Hourly    | 30 days   | 15 min | 1 hour |
| Redis       | RDB snapshots                  | Every 15 min | 7 days | 5 min  | 15 min |
| ArgoCD      | Git is the backup (GitOps)     | N/A       | Git history| 5 min | 0      |

### Recovery Procedures

```
# PostgreSQL point-in-time recovery
kubectl apply -f recovery/postgres-pitr.yaml  # Specify target timestamp

# ClickHouse restore from backup
kubectl exec -it clickhouse-0 -- clickhouse-backup restore <backup_name>

# Full cluster rebuild (nuclear option)
# 1. Provision new K8s cluster
# 2. Deploy ArgoCD
# 3. Point ArgoCD at the Git repo
# 4. ArgoCD rebuilds everything from Git (that's the point of GitOps)
# 5. Restore data from backups
```

---

## Runbooks

### Runbook: Kafka Consumer Lag Spike

```
Symptom: KafkaConsumerLagHigh alert firing
Impact: Data upload processing is delayed

Steps:
1. Check which consumer group is lagging:
   kubectl exec -it mfi-kafka-kafka-0 -n mfi-streaming -- \
     bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
     --describe --all-groups

2. Check if consumer pods are healthy:
   kubectl get pods -n mfi-app -l app=ingestion-worker
   kubectl logs -n mfi-app -l app=ingestion-worker --tail=100

3. If pods are healthy but slow:
   - Scale up: kubectl scale deployment ingestion-worker -n mfi-app --replicas=6
   - Or check ClickHouse for slow inserts

4. If pods are crash-looping:
   - Check logs for error
   - Common causes: ClickHouse connection refused, MinIO unavailable, OOM
   - Fix root cause, pods will auto-recover
```

### Runbook: ClickHouse Out of Disk

```
Symptom: DiskSpaceRunningLow alert for ClickHouse PVCs
Impact: Writes will fail, data pipeline stalls

Steps:
1. Check current usage:
   kubectl exec -it chi-mfi-clickhouse-0-0 -n mfi-data -- \
     clickhouse-client --query "SELECT name, free_space, total_space FROM system.disks"

2. Identify large tables:
   clickhouse-client --query "SELECT table, formatReadableSize(sum(bytes)) 
     FROM system.parts GROUP BY table ORDER BY sum(bytes) DESC"

3. If audit_log is largest: verify TTL is working
4. If loan_data is largest: check for duplicate uploads
5. Expand PVC:
   kubectl edit pvc data-chi-mfi-clickhouse-0-0 -n mfi-data
   # Change storage request (storageClass must support expansion)
```

### Runbook: Tenant Data Isolation Alert

```
Symptom: TenantDataIsolationViolation alert (CRITICAL)
Impact: POTENTIAL DATA BREACH - treat as P0 incident

Steps:
1. IMMEDIATELY: Check audit log for the violating request
2. Identify: which user, which tenant's data was accessed
3. Block: disable the user account immediately
4. Investigate: was this a bug or malicious?
5. Notify: inform affected tenant per data breach policy
6. Fix: patch the code path that allowed cross-tenant access
7. Post-mortem: mandatory within 24 hours
```

---

## Environment Promotion

```
Git Branches → Environments:

  main          → Production  (auto-sync with manual approval for data tier)
  staging       → Staging     (auto-sync)
  dev           → Development (auto-sync)

Image Tags:
  Production:  ghcr.io/mfi-insights/web:v1.2.3  (semver, immutable)
  Staging:     ghcr.io/mfi-insights/web:staging-abc1234  (commit SHA)
  Development: ghcr.io/mfi-insights/web:dev-abc1234  (commit SHA)
```

---

*Last updated: 2026-02-10*
*Maintained by: Platform Engineering Team*
*Review cadence: Monthly or on any architectural change*
