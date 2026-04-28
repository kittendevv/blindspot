import { parseArgs } from "util";
import { Glob } from "bun";

// Define options
const { positionals, values } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    recursive: { type: "boolean", short: "r" },
    ext: { type: "string", short: "e" }, // "png,webp"
    "dry-run": { type: "boolean", short: "d" },
    modify: { type: "boolean", short: "m" },
    "save-as-copy": { type: "boolean", short: "s" },
    "output-dir": { type: "string", short: "o" },
  },
});

// take input: preset + location
const [preset, location] = positionals;

// Load all files in specified directory with specified extensions, with fallback
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

// Janky implementation of the actual strip
if (preset == "full") {
  // Remove all metadata
  const proc = Bun.spawnSync([
    "exiftool",
    "-all=",
    ...(values.modify ? ["-overwrite_original"] : []),
    ...files,
  ]);
  console.log("Successfully stripped all metadata.");
} else if (preset == "gps") {
  // Remove all GPS data
  const proc = Bun.spawnSync([
    "exiftool",
    "-gps:all=",
    ...(values.modify ? ["-overwrite_original"] : []),
    ...files,
  ]);
  console.log("Successfully stripped all gps metadata");
} else if (preset == "web") {
  // Remove all GPS data + creator, owner, thumbnail, preview, artist
  const proc = Bun.spawnSync([
    "exiftool",
    "-gps:all=",
    "-xmp:CreatorTool=",
    "-Artist=",
    "-Creator=",
    "-OwnerName=",
    "-SerialNumber=",
    "-ThumbnailImage=",
    "-PreviewImage=",
    ...(values.modify ? ["-overwrite_original"] : []),
    ...files,
  ]);
  console.log("Successfully stripped metadata for web use");
} else {
  throw new Error("Unknown preset! These are the presets: full, gps, web");
}
