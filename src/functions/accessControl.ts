import {QueryEngine} from '@comunica/query-sparql'

// check if a person has the given access control modes associated with a specific acl file
export async function getAccessRightsAsk(acl, requester, modes, session) {
    try {
      const myEngine = new QueryEngine()
      const accessRights = [];
      for (const mode of modes) {
        let query = `
    PREFIX acl: <http://www.w3.org/ns/auth/acl#>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>
    
    ASK {?authorization
          a acl:Authorization ;
          acl:agent <${requester}> ;
          acl:mode <${mode}> .
    }`;
          const okay = await myEngine.queryBoolean(query, { sources: [acl], fetch: session.fetch })
          if (okay) accessRights.push(mode)
      }
    
      if (arraysEqual(modes, accessRights)) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.log(`error`, error)
    }
}



function arraysEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;

  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// discover the ACLs (also fallback-ACLs) governing a set of resources. If public; that is immediately returned
export async function discoverAcls(resources, session) {
    const existing = {}
    const pub = []
  
    async function recursiveAcl(res, originalResource) {
      const result = await session.fetch(res + '.acl', { headers: { method: "HEAD" } });
  
      if (result.status == 200) {
        if (!existing[res + '.acl']) {
          existing[res + '.acl'] = [originalResource]
        } else {
          existing[res + '.acl'].push(originalResource)
        }
        return
      } else {
        const short = res.split('/')
        short.pop()
        if (res.endsWith("/")) {
          short.pop()
        }
        const fallbackAcl = short.join("/") + "/"
        await recursiveAcl(fallbackAcl, originalResource)
      }
    }
  
    for (const res of Array.from(resources)) {
      const p = await session.fetch(res, { headers: { method: "HEAD" } }).then(i => {console.log(i); return i.headers.get('wac-allow').split(',')})
      if (p[p.length - 1].includes("pub") && p[p.length - 1].includes("read")) {
        pub.push(res)
      } else {
        await recursiveAcl(res, res)
      }
    }
    return { acl: existing, open: pub }
}
