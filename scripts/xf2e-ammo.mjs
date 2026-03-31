const MODULE = "xf2e-ammo"
const WEAPON_RANGES = [ 5, 10, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 300 ]
const AMMO_TYPES = {
	"shell": {
		label: `xf2e-ammo.AmmoType.shell`,
		stackGround: "shell"
	},
	"shell-gunblade": {
		label: `xf2e-ammo.AmmoType.shell-gunblade`,
		parent: "shell",
		magazine: false,
		weapon: "gunblade"
	}
}

function hasMeleeTrait(source) {
	return Array.isArray(traits) && source.system.traits?.value.includes("melee-ammo")
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

	const nxTrait = foundry.utils.getProperty(changed, "system.traits.value") ?? item.system.traits.value

	if (!Array.isArray(nxTrait))
		return

	if (nxTrait.includes("melee-ammo"))
		foundry.utils.setProperty(changed, "system.attribute", "str")
	else if (item.system.attribute == "str")
			foundry.utils.setProperty(changed, "system.attribute", null)
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
	const cls = CONFIG.Item.sheetClasses.weapon["pf2e.WeaponSheetPF2e"]?.cls

	if (!cls || cls.prototype.__xf2eAmmoPatched)
		return

	const orig = cls.prototype.getData

	cls.prototpye.getData = async function (...args) {
		const data = await orig.apply(this, args)
		data.weaponRanges = buildWeaponRanges()
		return data
	}

	cls.prototype.__xf2eAmmoPatched = true
})
