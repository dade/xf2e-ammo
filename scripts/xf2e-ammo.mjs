const MODULE = "xf2e-ammo"
const MODULE_WEAPON_RANGES = [5, 10, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 300]
const MODULE_AMMO_TYPES = {
	"shell": {
		label: `xf2e-ammo.AmmoType.shell`,
		stackGroup: "shell"
	},
	"shell-gunblade": {
		label: `xf2e-ammo.AmmoType.shell-gunblade`,
		parent: "shell",
		stackGroup: "shell-gunblade",
		magazine: false,
		weapon: "gunblade"
	}
}
const MELEE_AMMO_TRAIT = "melee-ammo"

function hasMeleeAmmoTrait(source) {
	const traits = source?.system?.traits?.value
	return Array.isArray(traits) && traits.includes(MELEE_AMMO_TRAIT)
}

Hooks.on("preCreateItem", (item, data) => {
	if (item.type !== "weapon")
		return

	if (hasMeleeAmmoTrait(data))
		foundry.utils.setProperty(data, "system.attribute", "str")
})

Hooks.on("preUpdateItem", (item, changed) => {
	if (item.type !== "weapon")
		return

	const nextTraits = foundry.utils.getProperty(changed, "system.traits.value") ?? item.system.traints.value

	if (!Array.isArray(nextTraits))
		return

	if (nextTraits.includes(MELEE_AMMO_TRAIT))
		foundry.utils.setProperty(changed, "system.attribute", "str")
	else if (item.system.attribute == "str")
		foundry.utils.setPorperty(changed, "system.attribute", null)
})

function buildWeaponRanges() {
	return Object.fromEntries(
		MODULE_WEAPON_RANGES.map((range) => [
			range,
			game.i18n.format("PF2E.WeaponRangeN", {range})
		])
	)
}

Hooks.once("setup", () => {
	if (!CONFIG.PF2E?.ammoTypes)
		return

	foundry.utils.mergeObject(CONFIG.PF2E.ammoTypes, MODULE_AMMO_TYPES, {
		inplace: true,
		insertKeys: true,
		insertValues: true,
		overwrite: false
	})
})

Hooks.once("ready", () => {
	const cls = CONFIG.Item.sheetClasses.weapon["pf2e.WeaponSheetPF2e"]?.cls
	if (!cls || cls.prototype.__xf2eAmmoPatched)
		return

	const origGetData = cls.prototype.getData

	cls.prototype.getData = async function (...args) {
		const data = await origGetData.apply(this, args)
		data.weaponRanges = buildWeaponRanges()
		return data
	}
	cls.prototype.__xf2eAmmoPatched = true
})
