targetScope = 'subscription'

param env string = 'dev'

param appPrefix string = '${env}-toc-middle'
param location string = 'eastus'

resource resourceGroup 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: '${appPrefix}-rg'
  location: location
}

module resources 'resources.bicep' = {
  scope: resourceGroup
  name: '${appPrefix}-res'
  params: {
    location: location
    appPrefix: appPrefix
    env: env
  }
}
