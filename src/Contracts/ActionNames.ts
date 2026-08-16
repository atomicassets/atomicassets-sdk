// Every action name the atomicassets contract (v1 plus v2) declares, so
// consumers can reference actions without hand-maintained string enums.
export const AtomicAssetsActionNames = [
    'acceptauswap',
    'acceptoffer',
    'addcolauth',
    'addconftoken',
    'addnotifyacc',
    'admincoledit',
    'announcedepo',
    'backasset',
    'burnasset',
    'canceloffer',
    'createauswap',
    'createcol',
    'createoffer',
    'createschema',
    'createtempl',
    'createtempl2',
    'declineoffer',
    'deltemplate',
    'extendschema',
    'forbidnotify',
    'init',
    'locktemplate',
    'logbackasset',
    'logburnasset',
    'logmint',
    'lognewoffer',
    'lognewtempl',
    'logrampayer',
    'logsetdata',
    'logsetdatatl',
    'logtransfer',
    'mintasset',
    'payofferram',
    'redtemplmax',
    'rejectauswap',
    'remcolauth',
    'remnotifyacc',
    'setassetdata',
    'setcoldata',
    'setlastpayer',
    'setmarketfee',
    'setrampayer',
    'setschematyp',
    'settempldata',
    'setversion',
    'transfer',
    'withdraw'
] as const;

export type AtomicAssetsActionName = typeof AtomicAssetsActionNames[number];

// Name-keyed map of the same actions, for consumers that reference actions as
// a value namespace (AtomicAssetsActions.settempldata). Mirrors the shape of
// @atomichub/atomicmarket's AtomicMarketActions.
// Annotated pure so a consumer that never names an action constant does not
// carry this map and the name list it is built from; the derivation reads only
// the literal above.
export const AtomicAssetsActions = /* @__PURE__ */ Object.fromEntries(
    /* @__PURE__ */ AtomicAssetsActionNames.map((name) => [name, name])
) as { readonly [K in AtomicAssetsActionName]: K };
