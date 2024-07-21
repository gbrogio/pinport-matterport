import type { Pinport, PinportClient } from "@pinport/client";
import type { MpSdk } from "@matterport/sdk";
import { hexToRgbPercent } from "./utils/hex-to-rgb";

export class MatterportExtension {
  constructor(
    private createPins: PinportClient<any>["createPins"],
    private getPins: PinportClient<any>["getPins"],
    private updatePins: PinportClient<any>["updatePins"],
    private deletePins: PinportClient<any>["deletePins"]
  ) {}
  /**
   * Sets up the Matterport SDK with the provided configuration.
   *
   * @param key - The API key used to authenticate with the Matterport SDK.
   * @param options - Configuration options for the Matterport SDK setup.
   * @param options.iframe - An optional iframe element to initialize the SDK with.
   * @param options.meta_id - An optional ID used to associate the SDK with a specific space. Required if using the container option.
   * @param options.container - An optional HTML element used to initialize the SDK with.
   * @param options.iframeAttributes - Optional attributes to set on the iframe element.
   * @param options.domain - The domain to use for the Matterport SDK. Defaults to "my.matterport.com" or "my.matterportvr.cn".
   * @param options.iframeQueryParams - Optional query parameters to include in the iframe URL.
   *
   * @throws Error if neither an iframe nor a container is provided.
   * @throws Error if using the container option without specifying a meta_id.
   *
   * @returns An object with a method to add pins to the Matterport instance.
   */
  async setupSdk(
    key: string,
    {
      meta_id,
      ...options
    }: {
      iframe?: HTMLIFrameElement;
      meta_id?: string;
      container?: HTMLElement;
      iframeAttributes?: Record<string, any>;
      domain?: "my.matterport.com" | "my.matterportvr.cn" | string;
      iframeQueryParams?:
        | Record<string, string | number | boolean>
        | URLSearchParams;
    }
  ) {
    if (!options.iframe && !options.container)
      throw Error(
        "The Matterport SDK requires either an iframe or a container for initialization."
      );
    if (options.container && !meta_id?.length)
      throw Error(
        "To use the container option, you need to set the 'meta_id' property first."
      );

    const { setupSdk } = await import("@matterport/sdk");
    const matterport = await setupSdk(key, {
      ...options,
      space: meta_id,
    });
    return {
      /**
       * Adds pins to the Matterport instance.
       * 
       * @param pins - An optional array of Pinport.Pin objects to be added. If not provided, only existing pins associated with the meta_id will be used.
       * 
       * @throws Error if there is an issue with adding the pins or if the meta_id is invalid.
       * 
       * @returns A promise that resolves when the pins have been successfully added.
       */
      addPins: (pins?: Pinport.Pin[]) =>
        this.addPins(matterport, pins, meta_id),
    };
  }

  private async addPins(
    matterport: MpSdk,
    pins: Pinport.Pin[] = [],
    meta_id?: string
  ) {
    if (!pins && !meta_id)
      throw Error(
        "To add pins, provide either a pins array or a meta_id in the setup configuration."
      );

    if (meta_id?.length) {
      try {
        const pinsToConcat = await this.getPins(meta_id);
        pins.push(...pinsToConcat);
      } catch (e) {
        // biome-ignore lint/complexity/noUselessCatch: <explanation>
        throw e;
      }
    }

    const pinsAttachments = await Promise.all(
      pins.map(async ({ id, html }, i) => ({
        attach: (
          await matterport!.Tag.registerSandbox(html, {
            name: id,
          })
        )[0],
        index: i,
      }))
    );

    await Promise.all(
      pinsAttachments.map(async (attachment) => {
        const pin = pins[attachment.index];
        await matterport!.Tag.add({
          id: pin.id,
          anchorPosition: pin.position,
          stemVector: pin.offset,
          attachments: [attachment.attach],
          opacity: pin.opacity,
          stemVisible: pin.enableLine,
          color: hexToRgbPercent(pin.color || '#000'),
          iconId: pin.icon?.length ? pin.icon : undefined,
        });
      })
    );
  }
}
