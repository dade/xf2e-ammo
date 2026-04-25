const MODULE = "xf2e-ammo"
const OPT_USE_AMMO = "xf2e-ammo:use"
const WEAPON_RANGES = [ 5, 10, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 300 ]
const AMMO_TYPES = {
	"shell": {
		label: `xf2e-ammo.AmmoType.shell`,
		stackGroup: "shell"
	},
	"shell-gunblade": {
		label: `xf2e-ammo.AmmoType.shell-gunblade`,
		parent: "shell",
		magazine: false,
		weapon: "gunblade"
	},
	"shell-loaded-gauntlet": {
		label: `xf2e-ammo.AmmoType.shell-loaded-gauntlets`,
		parent: "shell",
		magazine: false,
		weapon: "loaded-gauntlets"
	}
}

function hasMeleeTrait(weapon) {
	const traits = weapon.system.traits.value
	return Array.isArray(traits) && traits.includes("melee-ammo")
}

function hasConsumeOnHitTrait(weapon) {
	const traits = weapon.system.traits.value
	return Array.isArray(traits) && traits.includes("consume-on-hit")
}

function promptAmmo(weapon) {
	const traits = weapon?.system.traits.value
	return Array.isArray(traits) && traits.includes("melee-ammo") && !traits.includes("consume-on-hit")
}

function getRemainingAmmo(weapon) {
	const ammo = weapon?.ammo
	if (!ammo)
		return 0

	if (ammo.isOfType("ammo") && ammo.system.uses.max > 1)
		return ammo.system.uses.value ?? 0
}

function optionsSet(params) {
	if (params.options instanceof Set)
		return params.options

	const set = new Set(params.options ?? [])
	params.options = set
	return set
}

function hasUseAmmoOption(options) {
	if (options instanceof Set)
		return options.has(OPT_USE_AMMO)

	if (Array.isArray(options))
		return options.includes(OPT_USE_AMMO)

	return false
}

async function confirmAmmoUse(weapon) {
	const title = game.i18n.localize("PF2E.AttackRollLabel")
	const content = `<p>Spend ammo for this ${weapon.name} attack?</p>`

	if (foundry.applications.api.DialogV2.confirm) {
		return await foundry.applications.api.DialogV2.confirm({
			window: { title },
			content,
			modal: true,
			rejectClose: false
		})
	}

	return await Dialog.confirm({
		title,
		content,
		yes: () => true,
		no: () => false,
		defaultYes: true
	})
}

function patchMeleeAmmoPrompt() {
	if (!globalThis.libWrapper)
		return

	const path = "CONFIG.PF2E.Actor.documentClasses.character.prototype.prepareStrike"

	libWrapper.register(
		MODULE,
		path,
		function (wrapped, weapon, options) {
			const strike = wrapped(weapon, options)

			if (!strike || !promptAmmo(weapon))
				return strike

			for (const variant of strike.variants ?? []) {
				if (!variant.roll || variant.roll.__xf2eAmmoPromptWrapped)
					continue

				const origRoll = variant.roll
				const wrapRoll = async function (params = {}) {
					if (typeof params.consumeAmmo === "undefined") {
						const useAmmo = params.getFormula ? false : await confirmAmmoUse(weapon)
						params.consumeAmmo = useAmmo

						if (useAmmo)
							optionsSet(params).add(OPT_USE_AMMO)
					}

					return origRoll.call(this, params)
				}

				wrapRoll.__xf2eAmmoPromptWrapped = true
				variant.roll = wrapRoll
			}

			for (const key of [ "damage", "critical" ]) {
				const original = strike[key]
				if (typeof original !== "function" || original.__xf2eAmmoDamageWrapped)
					continue

				const wrappedDamage = async function (params = {}) {
					if (hasUseAmmoOption(params.checkContext?.options))
						optionsSet(params).add(OPT_USE_AMMO)

					return original.call(this, params)
				}

				wrappedDamage.__xf2eAmmoPromptWrapped = true
				strike[key] = wrappedDamage
			}

			if (strike.variants?.[0].roll) {
				strike.roll = strike.variants[0].roll
				strike.attack = strike.variants[0].roll
			}
			
			return strike
		},
		"WRAPPER"
	)
}

function patchAmmoConsumption() {
	if (!globalThis.libWrapper)
		return

	const path = "CONFIG.PF2E.Actor.documentClasses.character.prototype.consumeAmmo"

	libWrapper.register(
		MODULE,
		path,
		function (wrapped, weapon, params = {}) {
			if (!hasConsumeOnHitTrait(weapon))
				return wrapped(weapon, params)

			const ammo = weapon.ammo
			if (ammo) {
				if (ammo.quantity < 1) {
					ui.notifications.warn(game.i18n.localize("PF2E.ErrorMessage.NotEnoughAmmo"))
					return false
				}

				const existingCallback = params.callback
				params.callback = async (...args) => {
					const [, outcome] = args
					await existingCallback?.(...args)

					if (outcome === "success" || outcome === "criticalSuccess")
						await weapon.consumeAmmo()
				}
			}

			return true
		},
		"MIXED"
	)
}

Hooks.on("preCreateItem", (item, data) => {
	if (item.type !== "weapon")
		return

	if (hasMeleeTrait(data))
		foundry.utils.setProperty(data, "system.attribute", "str")
})

Hooks.on("preUpdateItem", (item, changed) => {
	if (item.type !== "weapon")
		return

	const nTrait = foundry.utils.getProperty(changed, "system.traits.value") ?? item.system.traits.value

	if (!Array.isArray(nTrait))
		return

	if (nTrait.includes("melee-ammo")) {
		foundry.utils.setProperty(changed, "system.attribute", "str")
	} else if (item.system.attribute == "str") {
		foundry.utils.setProperty(changed, "system.attribute", null)
	}
})

function buildWeaponRanges() {
	return Object.fromEntries(
		WEAPON_RANGES.map((range) => [
			range,
			game.i18n.format("PF2E.WeaponRangeN", {range})
		])
	)
}

Hooks.once("setup", () => {
	if (!CONFIG.PF2E.ammoTypes)
		return

	foundry.utils.mergeObject(CONFIG.PF2E.ammoTypes, AMMO_TYPES, {
		inplace: true,
		insertKeys: true,
		insertValues: true,
		overwrite: false
	})
})

Hooks.once("ready", () => {
	patchAmmoConsumption()
	patchMeleeAmmoPrompt()

	const cls = CONFIG.Item.sheetClasses.weapon["pf2e.WeaponSheetPF2e"]?.cls

	if (!cls || cls.prototype.__xf2eAmmoPathced)
		return

	const orig = cls.prototype.getData

	cls.prototype.getData = async function (...args) {
		const data = await orig.apply(this, args)
		data.weaponRanges = buildWeaponRanges()
		return data
	}
	cls.prototype.__xf2eAmmoPathced = true
})
