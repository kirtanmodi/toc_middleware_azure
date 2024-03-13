# Azure Bicep Serverless Demo

This project demonstrates how to set up a serverless system using Azure Bicep.

### Prerequisites

Ensure you have Azure CLI installed. Log in with your Azure account using:

```
az login
```

### Deployment

Navigate to the `infra` directory, where the `main.bicep` file is located, and execute:

```
az deployment sub create --location eastus --template-file main.bicep --parameters env=dev
```

This command sets up necessary Azure resources in your account, including a function app, service bus namespace, service bus queue, and a user-managed identity with service bus data owner permissions.

### Function App Configuration

After deployment, move to the `func` directory, which contains `host.json` and the function triggers. To configure the function for local testing, run:

```
func azure functionapp fetch-app-settings dev-toc-middleware-functions
```

To deploy the function to the Azure Function App:

```
func azure functionapp publish dev-toc-middleware-functions
```

### Local Testing

Start the function locally with:

```
func start
```

---