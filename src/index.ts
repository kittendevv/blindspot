import { parseArgs } from "util";
import { Glob } from "bun";
import { resolve } from "path";

// Define options
const { positionals, values } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    recursive: { type: "boolean", short: "r" }, //implemented
    ext: { type: "string", short: "e" }, // "png,webp" implemented
    "dry-run": { type: "boolean", short: "d" }, //implemented
    modify: { type: "boolean", short: "m" }, //implemented
    "save-as-copy": { type: "boolean", short: "s" },
    "output-dir": { type: "string", short: "o" }, //implemented
  },
});

// take input: preset + location
const [preset, location] = positionals;

// Load all files in specified directory with specified extensions, with fallback
if (location == undefined) {
  throw new Error(
    "No location provided, please provide a location. (/full/path, ./relative/path or just . for the current dir)",
  );
}

const exts = values.ext?.split(",") ?? ["png", "jpg", "jpeg"];
const pattern = values.recursive
  ? `**/*.{${exts.join(",")}}`
  : `*.{${exts.join(",")}}`;

const glob = new Glob(pattern);
const files = await Array.fromAsync(
  glob.scan({ cwd: location, onlyFiles: true }),
);

// Check for dry run
if (values["dry-run"]) {
  console.log("Would process:", files);
  console.log("With preset:", preset);
  process.exit(0);
}

if (values["output-dir"] != undefined) {
  const scanDir = resolve(location);
  const outputDir = resolve(values["output-dir"]);
  if (scanDir === outputDir) {
    throw new Error(
      "Your output dir cannot be the same directory as your input directory. If you wish to replace existing file use -m instead!",
    );
  }
}

function stripMeta(...args: string[]) {
  const proc = Bun.spawnSync([
    "exiftool",
    ...args,
    ...(values.modify ? ["-overwrite_original"] : []),
    ...(values["output-dir"] ? ["-o", resolve(values["output-dir"])] : []),
    ...files,
  ]);
}

// Janky implementation of the actual strip
if (preset === "full") {
  stripMeta("-all=");
  console.log("Successfully stripped all metadata.");
} else if (preset === "gps") {
  stripMeta("-gps:all=");
  console.log("Successfully stripped all GPS metadata.");
} else if (preset === "web") {
  stripMeta(
    "-gps:all=",
    "-xmp:CreatorTool=",
    "-Artist=",
    "-Creator=",
    "-OwnerName=",
    "-SerialNumber=",
    "-ThumbnailImage=",
    "-PreviewImage=",
  );
  console.log("Successfully stripped metadata for web use.");
} else {
  throw new Error("Unknown preset! These are the presets: full, gps, web");
}
