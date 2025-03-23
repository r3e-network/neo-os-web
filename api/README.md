# API Specifications

This directory contains API specifications for the Service Layer project.

## Directory Structure

- `swagger/` - OpenAPI (Swagger) specifications for all service endpoints

## Usage

The OpenAPI specifications in this directory serve multiple purposes:

1. **API Documentation**:
   - Defines the contract between the service and its clients
   - Documents all available endpoints, parameters, request bodies, and responses
   - Specifies authentication requirements and error responses

2. **Code Generation**:
   - Can be used to generate server stubs and client SDKs
   - Supports multiple languages through OpenAPI code generators

3. **API Testing**:
   - Provides a specification for API testing tools
   - Enables validation of API implementations against the specification

## Files Overview

The main specification files include:

- `swagger/openapi.yaml` - The main OpenAPI specification with common components
- `swagger/auth_endpoints.yaml` - Authentication API endpoints
- `swagger/functions_endpoints.yaml` - Functions service API endpoints
- `swagger/secrets_endpoints.yaml` - Secrets management API endpoints
- `swagger/gasbank_endpoints.yaml` - Gas Bank service API endpoints
- `swagger/pricefeed_endpoints.yaml` - Price Feed service API endpoints
- `swagger/oracle_endpoints.yaml` - Oracle service API endpoints
- `swagger/automation_endpoints.yaml` - Automation service API endpoints

## How to Use

### Viewing the API Documentation

You can use tools like Swagger UI or ReDoc to view the API documentation:

```bash
# Using Swagger UI Docker image
docker run -p 8080:8080 -e SWAGGER_JSON=/api/openapi.yaml -v $(pwd)/api/swagger:/api swaggerapi/swagger-ui
```

Then open your browser at http://localhost:8080.

### Generating Client Code

You can use the OpenAPI Generator to generate client code in various languages:

```bash
# Example: Generate a TypeScript client
openapi-generator generate -i api/swagger/openapi.yaml -g typescript-fetch -o clients/typescript
```

### Validating API Implementations

During development and testing, you can validate API responses against the specification:

```bash
# Using openapi-validator
openapi-validator --spec api/swagger/openapi.yaml --url http://localhost:8080/v1/
```

## Contributing

When adding new endpoints or modifying existing ones, please:

1. Update the relevant OpenAPI specification file
2. Validate the updated specification for correctness
3. Ensure backward compatibility when possible
4. Document any breaking changes