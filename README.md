# MatterportExtension

MatterportExtension is a TypeScript class designed to integrate the Matterport SDK with Pinport for adding interactive pins to Matterport 3D models. This extension allows for the seamless addition of pins into Matterport spaces by using Pinport's API to fetch pin data and the Matterport SDK to display them.

## Installation

To install the MatterportExtension along with the Pinport client, use the following command:

```bash
npm install @pinport/client @pinport/matterport
```

## Usage

### Importing and Initializing

To use the MatterportExtension, you need to import it and initialize an instance with your Pinport client:

```typescript
import { PinportClient } from "@pinport/client";
import { MatterportExtension } from "@pinport/matterport";

const pinport = new PinportClient("<api_url>", "<private_key>", {
  extensions: [matterportExtension],
});
```

### Setting Up the Matterport SDK

To set up the Matterport SDK, use the `setupSdk` method of the MatterportExtension instance. This method initializes the SDK and prepares it for adding pins.

```typescript
const sdkOptions = { 
  iframe: document.getElementById('matterport-iframe') as HTMLIFrameElement,
};

const pinportMatterport = pinport.extensions.matterport
  .setupSdk("<matterport_sdk_key>", sdkOptions)
  .then((sdk) => {
    console.log("Matterport SDK setup complete.");
  })
  .catch((error) => {
    console.error("Error setting up Matterport SDK:", error);
  });
```

### Adding Pins

Once the SDK is set up, you can add pins to your Matterport model using the `addPins` method. This method takes an array of pins fetched from Pinport and adds them to the Matterport model.

PinportClient is a TypeScript client for interacting with the Pinport API. It allows for creating and retrieving pins on the Pinport platform.

```typescript
const pins = await pinport.getPins('meta1');
await pinportMatterport.addPins(pins);
```

This project is licensed under the MIT License. See the LICENSE file for details.
