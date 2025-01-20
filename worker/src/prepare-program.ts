import { File } from "./models/base";
import path from "path";
import { decodeJson } from "../../shared/codec";
import fsp from "fs/promises";
import fs from "fs";
import { exec } from "../../shared/utils";
import { AI_ARENA_CONFIG_FILE_NAME, aiArenaConfigCodec } from "../../shared/common";

export async function prepareProgram(
  buildPath: string,
  programSource: File,
  targetProgramName: string,
) {
  const configFilePath = path.join(buildPath, "..", AI_ARENA_CONFIG_FILE_NAME);
  const targetProgramPath = path.join(buildPath, "..", targetProgramName);
  const parseConfig = async () =>
    decodeJson(aiArenaConfigCodec, (await fsp.readFile(configFilePath)).toString());
  let config;
  let buildLog;
  if (fs.existsSync(configFilePath) && fs.existsSync(targetProgramPath)) {
    config = await parseConfig();
  } else {
    await fsp.rm(buildPath, { recursive: true, force: true });
    await fsp.mkdir(buildPath, { recursive: true });
    await fsp.writeFile(path.join(buildPath, programSource.fileName), programSource.content);
    if (programSource.fileName.endsWith(".zip")) {
      await exec(`unzip ${programSource.fileName}`, { cwd: buildPath });
      await fsp.rename(path.join(buildPath, AI_ARENA_CONFIG_FILE_NAME), configFilePath);
    } else if (programSource.fileName.endsWith(".cpp")) {
      await fsp.writeFile(
        configFilePath,
        JSON.stringify(
          aiArenaConfigCodec.encode({
            build: `g++ -std=c++17 -O2 '${programSource.fileName}' -o ${targetProgramName}`,
            programPath: targetProgramName,
            run: "%program",
          }),
        ),
      );
    }
    config = await parseConfig();
    buildLog = (await exec(config.build, { cwd: buildPath })).stdout;
    await fsp.rename(path.join(buildPath, config.programPath), targetProgramPath);
  }
  return { runCommand: config.run, programPath: targetProgramPath, buildLog };
}
