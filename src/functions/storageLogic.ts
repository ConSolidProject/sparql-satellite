const { resolve } = require('path');
const { readdir } = require('fs').promises;

async function* getFiles(dir:string): any {
  const dirents = await readdir(dir, { withFileTypes: true });
  for (const dirent of dirents) {
    const res = resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      yield* getFiles(res);
    } else {
      yield res;
    }
  }
}


async function findRecursive(directory: string, filter: string[]) {
  const all = new Set()
  for await (const item of getFiles(directory)) {
      for (const suffix of filter) {
        if( item.endsWith(suffix)) {
            all.add(item.replaceAll("\\", "/"))
            all.add(item.replace(suffix, "").replaceAll("\\", "/"))
        }
      }
  }
  return all
}

export default findRecursive