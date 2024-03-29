param appPrefix string
param appName string = '${appPrefix}-functions'
param env string

param serviceBusNamespaceName string
param serviceBusQueueName string
param serviceBusUserIdentityId string
param serviceBusUserIdentityClientId string

param cosmoAccountEndpoint string
param cosmoDatabaseName string
param cosmoContainerName string
param cosmodbManagedIdentityID string
param cosmodbManagedIdentityClientId string

@allowed([
  'Standard_LRS'
  'Standard_GRS'
  'Standard_RAGRS'
])
param storageAccountType string = 'Standard_LRS'
var storageAccountName = '${env}tocazfunctions'

param location string

param appInsightsLocation string

@allowed([
  'node'
])
param runtime string = 'node'

var functionAppName = appName
var hostingPlanName = appName
var applicationInsightsName = appName

var functionWorkerRuntime = runtime

resource storageAccount 'Microsoft.Storage/storageAccounts@2022-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: storageAccountType
  }
  kind: 'Storage'
  properties: {
    supportsHttpsTrafficOnly: true
    defaultToOAuthAuthentication: true
  }
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: applicationInsightsName
  dependsOn: [
    storageAccount
  ]
  location: appInsightsLocation
  kind: 'web'
  properties: {
    Application_Type: 'web'
    Request_Source: 'rest'
  }
}

resource hostingPlan 'Microsoft.Web/serverfarms@2021-03-01' = {
  name: hostingPlanName
  dependsOn: [
    storageAccount
  ]
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {}
}

resource sqlServer 'Microsoft.Sql/servers@2020-11-01-preview' existing = {
  name: 'sqlservertesttoc' //change to the name of the existing SQL Server
  scope: resourceGroup('test')
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2020-11-01-preview' existing = {
  parent: sqlServer
  name: 'sqldb' //change to the name of the existing SQL Database
}

resource functionApp 'Microsoft.Web/sites@2021-03-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp'
  identity: {
    type: 'SystemAssigned, UserAssigned'
    userAssignedIdentities: {
      '${serviceBusUserIdentityId}': {}
      '${cosmodbManagedIdentityID}': {}
    }
  }
  properties: {
    serverFarmId: hostingPlan.id
    siteConfig: {
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower(functionAppName)
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~18'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: functionWorkerRuntime
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: applicationInsights.properties.InstrumentationKey
        }
        {
          name: 'servicebus__fullyQualifiedNamespace'
          value: '${serviceBusNamespaceName}.servicebus.windows.net'
        }
        {
          name: 'servicebus__credential'
          value: 'managedidentity'
        }
        {
          name: 'servicebus__clientID'
          value: serviceBusUserIdentityClientId
        }
        {
          name: 'serviceBusNamespaceName'
          value: serviceBusNamespaceName
        }
        {
          name: 'serviceBusQueueName'
          value: serviceBusQueueName
        }
        {
          name: 'cosmosdb__endpoint'
          value: cosmoAccountEndpoint
        }
        {
          name: 'cosmosdb__credential'
          value: 'managedidentity'
        }
        {
          name: 'cosmosdb__database'
          value: cosmoDatabaseName
        }
        {
          name: 'cosmosdb__container'
          value: cosmoContainerName
        }
        {
          name: 'cosmosdb__clientID'
          value: cosmodbManagedIdentityClientId
        }
        {
          name: 'SQLServerName'
          value: sqlServer.properties.fullyQualifiedDomainName
        }
        {
          name: 'SQLDatabaseName'
          value: sqlDatabase.name
        }
      ]
      ftpsState: 'FtpsOnly'
      minTlsVersion: '1.2'
    }
    httpsOnly: true
  }
}
