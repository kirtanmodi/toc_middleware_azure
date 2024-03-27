param appPrefix string
param location string

param accountName string = '${appPrefix}cosmosdbaccount'
param databaseName string = '${appPrefix}cosmosdbdatabase'
param containerName string = '${appPrefix}cosmosdbcontainer'

@description('Friendly name for the SQL Role Definition')
param roleDefinitionName string = 'My Read Write Role'

@description('Data actions permitted by the Role Definition')
param dataActions array = [
  'Microsoft.DocumentDB/databaseAccounts/readMetadata'
  'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/items/*'
  'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/*'
]

resource cosmoUserIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${appPrefix}-cosmo-UserIdentity'
  location: location
}

var principalId = cosmoUserIdentity.properties.principalId

var locations = [
  {
    locationName: location
    failoverPriority: 0
    isZoneRedundant: false
  }
]
var roleDefinitionIdStatic = guid('sql-role-definition-', appPrefix, location)
var roleAssignmentIdStatic = guid('sql-role-assignment-', appPrefix, location)

resource databaseAccount 'Microsoft.DocumentDB/databaseAccounts@2021-04-15' = {
  name: accountName
  location: location
  properties: {
    enableFreeTier: true
    databaseAccountOfferType: 'Standard'
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: locations
  }
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-11-15' = {
  parent: databaseAccount
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

resource container 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-11-15' = {
  parent: database
  name: containerName
  properties: {
    resource: {
      id: containerName
      partitionKey: {
        paths: [
          '/orderId'
        ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/_etag/?'
          }
        ]
      }
    }
  }
}

resource sqlRoleDefinition 'Microsoft.DocumentDB/databaseAccounts/sqlRoleDefinitions@2021-04-15' = {
  name: '${databaseAccount.name}/${roleDefinitionIdStatic}'
  properties: {
    roleName: roleDefinitionName
    type: 'CustomRole'
    assignableScopes: [
      databaseAccount.id
    ]
    permissions: [
      {
        dataActions: dataActions
      }
    ]
  }
}

resource sqlRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2021-04-15' = {
  name: '${databaseAccount.name}/${roleAssignmentIdStatic}'
  properties: {
    roleDefinitionId: sqlRoleDefinition.id
    principalId: principalId
    scope: databaseAccount.id
  }
}

output cosmoAccountEndpoint string = databaseAccount.properties.documentEndpoint
output cosmoDatabaseName string = database.name
output cosmoContainerName string = container.name
output cosmodbManagedIdentityID string = cosmoUserIdentity.id
output cosmodbManagedIdentityClientId string = cosmoUserIdentity.properties.clientId
