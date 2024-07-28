import { type MpSdk, setupSdk } from "@matterport/sdk";
import type { Pinport, PinportClient } from "@pinport/client";
import { hexToRgbPercent } from "./utils/hex-to-rgb";

type Vector3 = MpSdk.Vector3;

interface IntersectionResult {
	position: Vector3;
}

export class MatterportExtension {
	constructor(
		private createPins: PinportClient<any>["createPins"],
		private getPins: PinportClient<any>["getPins"],
		private updatePins: PinportClient<any>["updatePins"],
		private deletePins: PinportClient<any>["deletePins"],
		private getMetadata: PinportClient<any>["getMetadata"],
	) {}
	/**
	 * Sets up the Matterport SDK with the provided configuration.
	 *
	 * @param key - The API key used to authenticate with the Matterport SDK. If you pass `null` will be use the key in `user.metadata.matterport`
	 * @param options - Configuration options for the Matterport SDK setup.
	 * @param options.dynamicImport - Some frameworks like Next.js requires dynamic imports.
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
		key: string | null,
		{
			meta_id,
			dynamicImport = false,
			...options
		}: {
			dynamicImport?: boolean;
			iframe?: HTMLIFrameElement;
			meta_id?: string;
			container?: HTMLElement;
			iframeAttributes?: Record<string, any>;
			domain?: "my.matterport.com" | "my.matterportvr.cn" | string;
			iframeQueryParams?:
				| Record<string, string | number | boolean>
				| URLSearchParams;
		},
	) {
		if (!options.iframe && !options.container)
			throw Error(
				"The Matterport SDK requires either an iframe or a container for initialization.",
			);
		if (options.container && !meta_id?.length)
			throw Error(
				"To use the container option, you need to set the 'meta_id' property first.",
			);

		let setupMSdk = setupSdk;
		if (dynamicImport) {
			const { setupSdk: dynamicSetupSdk } = await import("@matterport/sdk");
			setupMSdk = dynamicSetupSdk;
		}
		let matterportKey = key;

		if (!matterportKey)
			matterportKey = await this.getMetadata("matterport")
				.then((r) => r.matterport)
				.catch(() => null);

		if (!matterportKey)
			throw Error(
				"On get Matterport SDK key. Please be sure that this key was provided in setupSdk or are available on `user.metadata.matterport`",
			);

		const matterport: MpSdk = await setupMSdk(matterportKey, {
			...options,
			space: meta_id,
		});

		let poseCache: MpSdk.Camera.Pose;
		matterport.Camera.pose.subscribe((pose) => {
			poseCache = pose;
		});

		let intersectionCache: IntersectionResult & { time: number };
		matterport.Pointer.intersection.subscribe((intersection) => {
			intersectionCache = {
				position: intersection.position,
				time: new Date().getTime(),
			};
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

			/**
			 * Get the current position of the camera view.
			 *
			 * @throws Error if there is not able to get position.
			 *
			 * @returns A position like `{ position: { x: number, y: number, z: number }, time: number }`.
			 * @remark time - the timestamp at which the position was computed.
			 *
			 */
			getPosition: async (): Promise<IntersectionResult & { time: number }> =>
				new Promise((resolve, reject) => {
					if (!intersectionCache || !poseCache) {
						reject(new Error("Can't get current position."));
					}

					resolve(intersectionCache);
				}),

			/**
			 * Transform a tridimensional position into a two-dimensional position based on the width and height of the iframe, container, or provided size.
			 *
			 * @param position - Optional position to transform. If not provided, the current position in camera view will be used.
			 * @param size - The object with the width and height of the iframe, container, or provided size.
			 *
			 * @returns A position like `{ x: number, y: number }`.
			 */
			positionToCordsIframe: async (
				position?: Vector3,
				size?: { w: number; h: number },
			) => {
				const width =
					size?.w ||
					options.iframe?.clientWidth ||
					options.container?.clientWidth;

				const height =
					size?.h ||
					options.iframe?.clientHeight ||
					options.container?.clientHeight;

				if (!width || !height) {
					throw new Error(
						"Unable to determine the size of the iframe or container.",
					);
				}

				const coord = matterport.Conversion.worldToScreen(
					position || intersectionCache.position,
					poseCache,
					{ w: width, h: height },
				);

				return {
					x: coord.x,
					y: coord.y,
				};
			},

			/**
			 * Move to a specific position in model.
			 *
			 * @param position - The position you want to go to.
			 * @param orientation - Optional camera rotation, where it will look.
			 *
			 */
			moveTo(position: Vector3, orientation?: Vector3) {
				matterport.Mode.moveTo(matterport.Mode.Mode.INSIDE, {
					transition: matterport.Mode.TransitionType.FLY,
					position,
					rotation: orientation,
				});
			},

			/**
			 * Move to a specific pin in model.
			 *
			 * @param pid - The pin id.
			 *
			 */
			async moveToPin(pid: string) {
				await matterport.Mattertag.navigateToTag(
					pid,
					matterport.Mattertag.Transition.FLY,
				);
			},
		};
	}

	private async addPins(
		matterport: MpSdk,
		pins: Pinport.Pin[] = [],
		meta_id?: string,
	) {
		if (!pins && !meta_id)
			throw Error(
				"To add pins, provide either a pins array or a meta_id in the setup configuration.",
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

		const existingIds = new Set<string>();
		const pinsAttachments = await Promise.all(
			pins.map(async ({ html }, i) => ({
				attach: (await matterport!.Tag.registerSandbox(html))[0],
				index: i,
			})),
		);

		await Promise.all(
			pinsAttachments.map(async (attachment) => {
				const pin = pins[attachment.index];
				const pinId = pin.id;
				if (existingIds.has(pinId)) return;
				existingIds.add(pinId);

				await matterport!.Tag.add({
					id: pinId,
					anchorPosition: pin.position,
					stemVector: pin.offset,
					attachments: [attachment.attach],
					opacity: pin.opacity,
					stemVisible: pin.enableLine,
					color: hexToRgbPercent(pin.color || "#000"),
					iconId: pin.icon?.length ? pin.icon : undefined,
				});
			}),
		);
	}
}
