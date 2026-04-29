import { parseArgs } from "util";
import { Glob } from "bun";
import { copyFile } from "fs/promises";
import { extname, basename, join, resolve } from "path";

const VERSION = "0.2.0";

// Define options
const { positionals, values } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    recursive: { type: "boolean", short: "r" }, //implemented
    ext: { type: "string", short: "e" }, // "png,webp" implemented
    "dry-run": { type: "boolean", short: "d" }, //implemented
    modify: { type: "boolean", short: "m" }, //implemented
    "save-as-copy": { type: "boolean", short: "s" }, // implemented
    "output-dir": { type: "string", short: "o" }, //implemented
    version: { type: "boolean", short: "v" }, //implemented
    help: { type: "boolean", short: "h" }, // implemented
  },
});

// take input: preset + location
const [preset, location] = positionals;

// print version and exit
if (values["version"]) {
  console.log("Current version of blindspot:", VERSION);
  process.exit(0);
}

// print help and exit
if (values.help) {
  console.log(`
Usage: blindspot <preset> <location> [options]

Presets:
  full    Strip all metadata
  gps     Strip GPS data only
  web     Strip GPS, creator, owner, thumbnail and preview data

Options:
  -r, --recursive         Scan subdirectories
  -e, --ext <exts>        File extensions to process (default: png,jpg,jpeg)
  -d, --dry-run           List files that would be processed without modifying them
  -m, --modify            Overwrite original files (default: saves a copy)
  -s, --save-as-copy      Save as a copy with .clean extension
  -o, --output-dir <dir>  Output directory for processed files
  -h, --help              Show this help message

Examples:
  blindspot full .
  blindspot gps ./photos -r
  blindspot web /home/user/photos -e png,jpg -o ./clean
`);
  process.exit(0);
}

if (!Bun.which("exiftool")) {
  throw new Error(
    "exiftool is not installed. Please install it first: https://github.com/kittendevv/blindspot#installing--requirements",
  );
}

if (!preset || !["full", "gps", "web"].includes(preset)) {
  throw new Error("Unknown preset! These are the presets: full, gps, web");
}

// Load all files in specified directory with specified extensions, with fallback
if (location == undefined) {
  throw new Error(
    "No location provided, please provide a location. (/full/path, ./relative/path or just . for the current dir)",
  );
}

const exts = values.ext?.split(",") ?? [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "tiff",
  "heic",
  "avif",
];
const pattern = values.recursive
  ? `**/*.{${exts.join(",")}}`
  : `*.{${exts.join(",")}}`;

const glob = new Glob(pattern);
const files = await Array.fromAsync(
  glob.scan({ cwd: location, onlyFiles: true }),
);

if (files.length === 0) {
  console.log(
    "No files matched, check if your input path is correct, or if your file extensions are correct see help to match custom file extensions. (default checked extensions: png, jpg, jpeg, webp, tiff, heic, avif)",
  );
  process.exit(0);
}

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

// for save-as-copy
async function saveAsCopy(files: string[], cwd: string) {
  return Promise.all(
    files.map((file) => {
      const ext = extname(file); // Eg: .png
      const name = basename(file, ext); // Eg: cat
      const copy = join(cwd, `${name}.clean${ext}`); // Eg: cat.clean.png
      return copyFile(join(cwd, file), copy).then(() => copy);
    }),
  );
}

let filesToProcess = files;

if (values["save-as-copy"]) {
  filesToProcess = await saveAsCopy(files, resolve(location));
}

function stripMeta(...args: string[]) {
  console.log("Stripping:", filesToProcess);
  const proc = Bun.spawnSync([
    "exiftool",
    ...args,
    ...(values.modify ? ["-overwrite_original"] : []),
    ...(values["output-dir"] ? ["-o", resolve(values["output-dir"])] : []),
    ...filesToProcess,
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
