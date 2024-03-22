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

module functionApp 'modules/functionApp.bicep' = {
  name: 'functionApp'
  dependsOn: [
    servicebus
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
  }
}
