# USSD Dev Kubernetes Deployment

This directory contains Kubernetes deployment files for the USSD development environment.

## Files

- `ussd-dev-namespace.yaml` - Creates the ussd-dev namespace
- `ussd-dev-deployment.yaml` - Main deployment configuration
- `ussd-dev-service.yaml` - Service configuration for internal communication

## Memory Configuration

The deployment has been optimized with the following memory settings:

- **Memory Limit**: 1Gi (1024 MB)
- **Memory Request**: 256Mi (256 MB)
- **JVM Heap**: 768MB maximum, 256MB initial
- **JVM Options**: G1GC with container support enabled

## Health Checks

Health checks are currently commented out in the deployment file because the application may not expose a `/health` endpoint. To enable health checks:

1. Uncomment the `livenessProbe` and `readinessProbe` sections
2. Adjust the `path` to match your application's health endpoint
3. Adjust timing parameters as needed

## Deployment

To deploy the USSD application:

```bash
# Apply all configurations
kubectl apply -f k8s/

# Or apply individually
kubectl apply -f k8s/ussd-dev-namespace.yaml
kubectl apply -f k8s/ussd-dev-deployment.yaml
kubectl apply -f k8s/ussd-dev-service.yaml
```

## Monitoring

Check the deployment status:

```bash
# Check pod status
kubectl get pods -n ussd-dev

# Check logs
kubectl logs -n ussd-dev -l app.kubernetes.io/name=ussd

# Check resource usage
kubectl top pods -n ussd-dev
```

## Troubleshooting

If the application keeps restarting:

1. Check memory usage: `kubectl describe pod -n ussd-dev <pod-name>`
2. Check logs for OOM errors: `kubectl logs -n ussd-dev <pod-name> --previous`
3. Increase memory limits if needed in the deployment file
4. Verify health check endpoints if health checks are enabled

## Configuration Notes

- The application uses a 5-minute initial delay for startup
- Termination grace period is set to 5 minutes
- Progress deadline is set to 10 minutes
- JVM is configured to use G1GC for better memory management

