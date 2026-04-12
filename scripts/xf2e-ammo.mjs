const MODULE = "xf2e-ammo"
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
