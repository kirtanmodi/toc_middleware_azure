param location string
param appPrefix string
param env string

module servicebus 'modules/serviceBus.bicep' = {
  name: 'servicebus'
  params: {
    appPrefix: appPrefix
    location: location
  }
}

module cosmosDb 'modules/cosmodb.bicep' = {
  name: 'cosmosDb'
  params: {
    appPrefix: appPrefix
    location: location
  }
}

module functionApp 'modules/functionApp.bicep' = {
  name: 'functionApp'
  dependsOn: [
    servicebus
    cosmosDb
  ]
  params: {
    appPrefix: appPrefix
    location: location
    appInsightsLocation: location
    serviceBusNamespaceName: servicebus.outputs.serviceBusNamespaceName
    serviceBusQueueName: servicebus.outputs.serviceBusQueueName
    serviceBusUserIdentityClientId: servicebus.outputs.serviceBusUserIdentityClientId
    serviceBusUserIdentityId: servicebus.outputs.serviceBusUserIdentityId
    env: env
    cosmoAccountEndpoint: cosmosDb.outputs.cosmoAccountEndpoint
    cosmoDatabaseName: cosmosDb.outputs.cosmoDatabaseName
    cosmoContainerName: cosmosDb.outputs.cosmoContainerName
    cosmodbManagedIdentityID: cosmosDb.outputs.cosmodbManagedIdentityID
    cosmodbManagedIdentityClientId: cosmosDb.outputs.cosmodbManagedIdentityClientId
  }
}
