# RESTful API Design Rules and Conventions

## 1. Introduction

This document defines general principles, rules, and conventions for designing RESTful APIs. It covers URL structure, HTTP methods, request formats, response formats, status codes, error handling, and security.

The goal is to make APIs consistent, predictable, maintainable, and easy for different clients and services to integrate with.

## 2. RESTful Design Principles

REST (Representational State Transfer) is an architectural style for designing networked systems.

A RESTful API should follow these principles:

- **Resource-oriented:** Model the API around resources, such as users, products, orders, and comments.
- **Stateless communication:** Each request contains the information necessary to process it. The server does not rely on stored client session state between requests.
- **Uniform interface:** Use consistent resource identifiers, HTTP methods, representations, and status codes.
- **Client-server separation:** Clients and servers can evolve independently through a defined API contract.
- **Cacheability:** Responses should indicate whether caching is permitted when appropriate.
- **Layered architecture:** Clients do not need to know whether they communicate directly with the origin server or through intermediary layers.

REST is an architectural style, not a rigid specification for every URL or JSON response. The conventions below are recommended practices rather than universal requirements.

## 3. URL Naming Conventions

### 3.1 Resource-Oriented URLs

Use nouns to represent resources instead of verbs to describe actions.

Recommended:

```http
GET    /users
GET    /users/123
POST   /users
PUT    /users/123
PATCH  /users/123
DELETE /users/123
```

Avoid action-oriented URLs when a standard HTTP method can express the operation:

```http
GET  /getUsers
POST /createUser
POST /deleteUser/123
```

### 3.2 Naming Rules

- Use lowercase letters in URL paths.
- Prefer plural nouns for collection resources.
- Use hyphens to separate multiple words.
- Avoid unnecessary trailing slashes and keep URL conventions consistent.
- Use path parameters to identify individual resources.
- Use nested resources when the parent-child relationship is meaningful.
- Avoid deeply nested paths unless they communicate a necessary relationship.
- Do not expose internal database table names or implementation details unnecessarily.

Examples:

```http
GET /api/v1/blog-posts
GET /api/v1/blog-posts/123
GET /api/v1/blog-posts/123/comments
GET /api/v1/users/456/orders
```

### 3.3 API Versioning

A common approach is to include the API version in the URL:

```http
/api/v1/users
/api/v2/users
```

Versioning allows APIs to introduce breaking changes without immediately disrupting existing clients. The versioning strategy should be consistent and documented.

## 4. HTTP Methods

HTTP methods define the intended operation on a resource.

| Method | Purpose | Request Body | Idempotent |
|---|---|---|---|
| GET | Retrieve a resource or collection | Generally no | Yes |
| POST | Create a resource or submit an operation | Usually yes | Not guaranteed |
| PUT | Replace a resource | Usually yes | Yes |
| PATCH | Partially modify a resource | Usually yes | Depends on the patch operation |
| DELETE | Delete a resource | Usually no | Yes |

**Idempotency** means that making the same request multiple times has the same intended effect on server state as making it once.

Additional rules:

- `GET` must not perform state-changing operations.
- `POST` is commonly used to create resources or initiate operations.
- `PUT` should follow replacement semantics for the target resource.
- `PATCH` modifies a resource according to the defined patch format.
- `DELETE` removes a resource or marks it as deleted, depending on the API's documented behavior.

Idempotency does not require every repeated request to return an identical response. For example, the first successful deletion may return `204`, while a subsequent deletion may return `404`.

## 5. HTTP Request Format

An HTTP request consists of a request line, headers, an optional body, and protocol framing.

General structure:

```http
METHOD /path?query=value HTTP/1.1
Host: api.example.com
Content-Type: application/json
Accept: application/json
Authorization: Bearer <access_token>

{
  "key": "value"
}
```

The request body is optional and depends on the HTTP method and endpoint contract.

### 5.1 Request Headers

| Header | Purpose |
|---|---|
| `Content-Type` | Describes the format of the request body |
| `Accept` | Specifies the response media types accepted by the client |
| `Authorization` | Carries authentication credentials when required |
| `Accept-Language` | Indicates preferred response language when supported |
| `If-Match` | Supports conditional requests, including optimistic concurrency control |

Example:

```http
POST /api/v1/products HTTP/1.1
Content-Type: application/json
Accept: application/json
Authorization: Bearer <access_token>
```

Use `Content-Type: application/json` when submitting a JSON body. Do not send headers that are unnecessary for the endpoint.

### 5.2 Path Parameters

Path parameters identify a particular resource or a specific resource within a hierarchy.

```http
GET /api/v1/products/123
GET /api/v1/users/456/orders/789
```

Use them for resource identity rather than optional search criteria.

### 5.3 Query Parameters

Query parameters are used for filtering, searching, sorting, pagination, and other optional request criteria.

```http
GET /api/v1/products?category=books
GET /api/v1/products?keyword=design
GET /api/v1/products?sort=price,asc
GET /api/v1/products?page=0&size=20
```

Conventions:

- Use descriptive parameter names.
- Encode special characters according to URL encoding rules.
- Define default values and validation rules.
- Restrict sorting fields to an explicit allowlist.
- Set reasonable pagination limits.
- Document how multiple filter values are represented.

### 5.4 Request Bodies

Use JSON for typical resource creation and modification when the API supports JSON.

Create a resource:

```http
POST /api/v1/products
Content-Type: application/json
```

```json
{
  "name": "Wireless Keyboard",
  "price": 49.99,
  "categoryId": "cat-123"
}
```

Replace a resource:

```http
PUT /api/v1/products/123
Content-Type: application/json
```

```json
{
  "name": "Wireless Keyboard",
  "price": 59.99,
  "categoryId": "cat-123"
}
```

Partially update a resource:

```http
PATCH /api/v1/products/123
Content-Type: application/json
```

```json
{
  "price": 54.99
}
```

The API must define whether omitted properties remain unchanged, whether explicit `null` values are permitted, and which fields can be modified.

### 5.5 Data Naming and Types

Use consistent JSON property naming, commonly `camelCase`.

```json
{
  "firstName": "Alex",
  "isActive": true,
  "createdAt": "2026-10-19T09:00:00Z",
  "tags": ["design", "technology"]
}
```

Recommended conventions:

- Represent booleans as `true` or `false`.
- Represent numeric values as JSON numbers when appropriate.
- Represent dates and timestamps using documented ISO 8601 formats.
- Use consistent ID types for the same resource.
- Distinguish between omitted properties, `null`, and empty values.
- Avoid exposing password hashes, internal secrets, or sensitive implementation details.

## 6. HTTP Response Format

An HTTP response contains a status code, headers, and an optional response body.

### 6.1 Successful Responses

Retrieve a resource:

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "id": "123",
  "name": "Wireless Keyboard",
  "price": 49.99
}
```

Create a resource:

```http
HTTP/1.1 201 Created
Location: /api/v1/products/123
Content-Type: application/json
```

```json
{
  "id": "123",
  "name": "Wireless Keyboard",
  "price": 49.99
}
```

Delete a resource without returning a body:

```http
HTTP/1.1 204 No Content
```

### 6.2 Response Structure

There is no single mandatory JSON envelope for all RESTful APIs. A response can contain the resource directly or use a documented wrapper.

Direct resource representation:

```json
{
  "id": "123",
  "name": "Wireless Keyboard"
}
```

Wrapped representation:

```json
{
  "data": {
    "id": "123",
    "name": "Wireless Keyboard"
  }
}
```

Choose a structure based on the API's requirements and apply it consistently. Do not add unnecessary wrapper fields that duplicate HTTP status information.

### 6.3 Collection Responses

Collection endpoints should define a consistent format for lists and pagination.

```json
{
  "content": [
    {
      "id": "123",
      "name": "Wireless Keyboard"
    },
    {
      "id": "124",
      "name": "USB-C Hub"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 42,
  "totalPages": 3
}
```

The property names are illustrative. Cursor-based pagination is another option for large or frequently changing collections.

## 7. HTTP Status Codes

Use standard HTTP status codes to communicate the outcome of a request.

| Code | Meaning | Typical Use |
|---|---|---|
| 200 | OK | Successful retrieval or update |
| 201 | Created | Resource created successfully |
| 202 | Accepted | Request accepted for asynchronous processing |
| 204 | No Content | Successful operation with no response body |
| 400 | Bad Request | Invalid request syntax or parameters |
| 401 | Unauthorized | Authentication is missing or invalid |
| 403 | Forbidden | Caller lacks permission |
| 404 | Not Found | Resource does not exist or is not exposed to the caller |
| 405 | Method Not Allowed | HTTP method is unsupported for the resource |
| 409 | Conflict | Request conflicts with the current resource state |
| 412 | Precondition Failed | A conditional request precondition failed |
| 415 | Unsupported Media Type | Request body format is unsupported |
| 422 | Unprocessable Content | Request content fails semantic validation |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | Service is temporarily unavailable |

Choose the status code that best describes the result. For example, authentication failures should not be represented as successful `200 OK` responses.

## 8. Error Handling

Error responses should be consistent, informative, and safe. A recommended standard is Problem Details for HTTP APIs, defined by RFC 9457.

Example:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json
```

```json
{
  "type": "about:blank",
  "title": "Validation Error",
  "status": 400,
  "detail": "The request contains invalid fields.",
  "instance": "/api/v1/products",
  "errors": [
    {
      "field": "name",
      "message": "Name must not be blank."
    },
    {
      "field": "price",
      "message": "Price must be greater than zero."
    }
  ]
}
```

The `errors` property is an application-specific extension.

Error-handling rules:

- Return the appropriate HTTP status code.
- Use a consistent error schema.
- Provide actionable messages without exposing internal details.
- Include field-level validation errors where useful.
- Do not expose stack traces, SQL statements, passwords, tokens, or secret configuration.
- Use stable machine-readable error codes when clients need to handle specific error conditions.

## 9. Filtering, Sorting, and Pagination

Collection endpoints should support query parameters where appropriate.

Filtering:

```http
GET /api/v1/products?category=electronics&minPrice=100
```

Sorting:

```http
GET /api/v1/products?sort=price,asc
```

Pagination:

```http
GET /api/v1/products?page=0&size=20
```

Combined:

```http
GET /api/v1/products?category=electronics&sort=price,asc&page=0&size=20
```

Rules:

- Validate filter values and allowed sort fields.
- Define default sorting behavior where ordering matters.
- Enforce maximum page sizes.
- Document page-number conventions.
- Consider cursor-based pagination for large datasets.
- Return pagination metadata when clients need it.

## 10. Resource Relationships and Operations

Represent meaningful resource relationships through nested URLs.

```http
GET  /api/v1/users/123/orders
POST /api/v1/users/123/orders
GET  /api/v1/orders/456/items
```

Keep nesting reasonably shallow. If a resource has an independent identity, it may be better to expose it directly:

```http
GET /api/v1/orders/456
```

Some domain operations do not map naturally to basic CRUD. An explicit action endpoint can be appropriate:

```http
POST /api/v1/orders/456/cancel
```

Alternatively, a resource's state may be modified using `PATCH`, if the API's domain rules permit it.

Do not force every operation into CRUD if doing so makes the API unclear. Ensure that business rules, permissions, and state transitions are enforced by the server.

## 11. Authentication and Security

Security must be enforced independently of URL naming and request formatting.

Recommended practices:

- Use HTTPS for requests containing credentials or sensitive information.
- Use established authentication mechanisms such as OAuth 2.0 or appropriately designed token-based authentication where applicable.
- Send bearer tokens through the `Authorization` header.
- Authenticate callers before accessing protected resources.
- Check permissions and resource ownership on the server.
- Validate all incoming input.
- Apply rate limits and request-size limits where appropriate.
- Avoid sensitive information in URLs because URLs may appear in logs, browser history, and monitoring systems.
- Use appropriate caching controls for sensitive responses.
- Apply CSRF protection when required by the chosen authentication mechanism and deployment model.

Example:

```http
GET /api/v1/profile
Authorization: Bearer <access_token>
```

Do not rely on the frontend to enforce authorization.

## 12. Caching and Conditional Requests

HTTP provides mechanisms to reduce unnecessary network traffic and prevent conflicting updates.

Example response headers:

```http
Cache-Control: public, max-age=300
ETag: "abc123"
```

A client can use the returned entity tag in a subsequent request:

```http
GET /api/v1/products/123
If-None-Match: "abc123"
```

If the representation has not changed, the server can return `304 Not Modified`.

For updates, `ETag` combined with `If-Match` can help prevent lost updates when multiple clients modify the same resource.

Cache policies must reflect the sensitivity and freshness requirements of the data. Do not publicly cache private responses.

## 13. Idempotency and Retry Behavior

Network failures can occur even when a server has already processed a request. APIs should document safe retry behavior.

- `GET`, `PUT`, and `DELETE` are defined as idempotent methods.
- `POST` is not inherently idempotent.
- Clients should not blindly retry non-idempotent operations after an ambiguous failure.
- APIs that support retry-safe creation or payment operations may provide idempotency keys.

Example:

```http
POST /api/v1/payments
Idempotency-Key: 7f6c-example-key
Content-Type: application/json
```

The server must define how keys are scoped, how long they remain valid, and how repeated requests are handled. An idempotency key is an application-level convention, not a universal HTTP requirement.

## 14. File Uploads and Downloads

Use `multipart/form-data` when an endpoint accepts files alongside metadata.

```http
POST /api/v1/files
Content-Type: multipart/form-data
```

Document:

- Supported file types.
- Maximum file size.
- Required metadata.
- Authentication and authorization requirements.
- File naming and storage behavior.
- Validation and malware-scanning requirements, where applicable.

For downloads, use appropriate response headers such as `Content-Type` and, when applicable, `Content-Disposition`.

## 15. API Documentation and Contract

Each endpoint should document:

1. HTTP method and URL.
2. Purpose and behavior.
3. Authentication and authorization requirements.
4. Path parameters and query parameters.
5. Required and optional headers.
6. Request body schema and example.
7. Validation constraints.
8. Success response schemas and status codes.
9. Error response schemas and status codes.
10. Pagination, caching, and retry behavior where applicable.

Use OpenAPI to describe API contracts and generate documentation, client SDKs, or validation support when useful.

## 16. Design Checklist

Before publishing an API endpoint, verify the following:

- [ ] Resource-oriented and consistently named URLs.
- [ ] Correct HTTP method and documented semantics.
- [ ] Consistent headers and request formats.
- [ ] Defined path parameters, query parameters, and body schemas.
- [ ] Appropriate HTTP status codes.
- [ ] Consistent success and error responses.
- [ ] Input validation and safe error messages.
- [ ] Authentication, authorization, and ownership checks.
- [ ] Pagination and filtering for large collections.
- [ ] Documented caching and retry behavior where relevant.
- [ ] OpenAPI documentation and automated tests.
- [ ] No sensitive information exposed in URLs or responses.

## 17. Conclusion

A well-designed RESTful API provides a stable and predictable contract between clients and servers. The most important practices are resource-oriented URLs, correct HTTP method semantics, consistent request and response formats, appropriate status codes, secure authorization, and clear documentation.

These conventions should be applied consistently while allowing exceptions when justified by the requirements of the API and its domain.

## References

- Roy Fielding, *Architectural Styles and the Design of Network-based Software Architectures*, 2000.
- RFC 9110 — HTTP Semantics.
- RFC 9111 — HTTP Caching.
- RFC 9457 — Problem Details for HTTP APIs.
- OpenAPI Specification — API description standard.
