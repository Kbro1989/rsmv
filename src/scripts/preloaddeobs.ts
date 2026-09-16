import { Openrs2CacheSource, validOpenrs2Caches } from "../cache/openrs2loader";
import { ClientScriptDeobLoader } from "../clientscript";
import { CLIScriptOutput, ScriptOutput } from "../scriptrunner";


export async function preloadDeobs(output: ScriptOutput, ncaches: number, maxagedays: number) {
    let caches = await validOpenrs2Caches();
    let betacaches = await validOpenrs2Caches("beta");

    let allcaches = [...caches, ...betacaches];

    let maxage = 1000 * 60 * 60 * 24 * maxagedays;
    let now = Date.now();

    allcaches = allcaches.filter(q => q.timestamp && new Date(q.timestamp!).getTime() > now - maxage);
    allcaches.sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime());
    allcaches = allcaches.slice(0, ncaches);

    for (let cache of allcaches) {
        let source = new Openrs2CacheSource(cache);
        output.log(`== Processing cache: ${source.getCacheMeta().name} ${source.getCacheMeta().timestamp.toDateString()} ==`);
        let loader = ClientScriptDeobLoader.forCache(source);
        let subscriptout = new CLIScriptOutput();
        subscriptout.log = output.log.bind(output);
        let deob = await loader.loadOrGenerate(source, async () => subscriptout);
        await deob.ensureSubtypes(output);
        await deob.save();
    }
}