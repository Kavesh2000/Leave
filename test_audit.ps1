# Test audit logging functionality

$baseUrl = "http://localhost:3001"

# Step 1: Login as admin
Write-Host "Step 1: Logging in as admin..."
$loginResponse = Invoke-WebRequest -Uri "$baseUrl/api/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body (@{email='admin@maishabank.com'; password='Admin@123'} | ConvertTo-Json) `
  -SessionVariable sv `
  -UseBasicParsing

Write-Host "Login Status: $($loginResponse.StatusCode)"
$loginData = $loginResponse.Content | ConvertFrom-Json
Write-Host "Login Response: $($loginData | ConvertTo-Json)"

# Step 2: Create a test employee
Write-Host "`nStep 2: Creating a test employee..."
$testUser = @{
    full_name = "Audit Test User $(Get-Date -Format 'ddHHmmss')"
    email = "audittest_$(Get-Random)@test.com"
    password = "Test@123"
    role = "employee"
    department = "Marketing"
}

$createResponse = Invoke-WebRequest -Uri "$baseUrl/api/users" `
  -Method Post `
  -ContentType "application/json" `
  -Body ($testUser | ConvertTo-Json) `
  -WebSession $sv `
  -UseBasicParsing

Write-Host "Create User Status: $($createResponse.StatusCode)"
$createData = $createResponse.Content | ConvertFrom-Json
$newUserId = $createData.id
Write-Host "Created User ID: $newUserId"
Write-Host "Created User Response: $($createData | ConvertTo-Json)"

# Step 3: Get audit logs
Write-Host "`nStep 3: Fetching audit logs..."
Start-Sleep -Seconds 1

$auditResponse = Invoke-WebRequest -Uri "$baseUrl/api/audit-logs?limit=10" `
  -Method Get `
  -WebSession $sv `
  -UseBasicParsing

Write-Host "Audit Logs Status: $($auditResponse.StatusCode)"
$auditData = $auditResponse.Content | ConvertFrom-Json
Write-Host "Audit Logs Count: $($auditData.data.Count)"
Write-Host "Total Audit Entries: $($auditData.pagination.total)"
Write-Host "Recent Audit Logs:"
$auditData.data | Select-Object -First 5 | Format-Table timestamp, action, user_email, entity_type, entity_id, details

# Step 4: Get activities for the created user
Write-Host "`nStep 4: Fetching activities for created user (ID: $newUserId)..."
$activitiesResponse = Invoke-WebRequest -Uri "$baseUrl/api/employee/$newUserId/activities" `
  -Method Get `
  -WebSession $sv `
  -UseBasicParsing

Write-Host "Activities Status: $($activitiesResponse.StatusCode)"
$activitiesData = $activitiesResponse.Content | ConvertFrom-Json
Write-Host "Activities Count: $($activitiesData.data.Count)"
Write-Host "User Activities:"
$activitiesData.data | Format-Table timestamp, action, user_email, entity_type, entity_id, details

Write-Host "`nAudit logging test completed successfully!"
