import type { Pinport } from "@pinport/client";
import { type MpSdk, setupSdk } from "@matterport/sdk";

export class MatterportExtension {
	constructor(private fetch: Pinport.PinportFetch) {}

	async setupSdk(key: string, options: { iframe: HTMLIFrameElement }) {
		const matterport = await setupSdk(key, options);
		return {
			addPins: (pins: Pinport.Pin[]) => this.addPins(matterport, pins),
		}
	}

	// private throwIfNotInitialized(matterport: MpSdk) {
	// 	if (!matterport)
	// 		throw Error(
	// 			"MatterPort SDK need be initialize! Please call setupSdk before use any method.",
	// 		);
	// }

	private async addPins(matterport: MpSdk, pins: Pinport.Pin[]) {
		const pinsAttachments = await Promise.all(
			pins.map(async ({ id, html }, i) => ({
				attach: (await matterport!.Tag.registerSandbox(html, {
					name: id,
				}))[0],
        index: i,
			})),
		);

		await Promise.all(pinsAttachments.map(async (attachment) => {
			const pin = pins[attachment.index];
			await matterport!.Tag.add({
				id: pin.id,
				anchorPosition: pin.position,
				stemVector: pin.offset,
				attachments: [attachment.attach],
				opacity: pin.opacity,
				stemVisible: pin.enableLine,
				iconId: pin.icon,
			});
		}));
	}
}
