// Every download option the API accepts, described once. The form is drawn from this list and the
// request is built from it, so adding an option is one line here.
//
// type: text | number | bool | select | list (comma separated) | lines (one per line) | secret
//   | preset (a dropdown of known values with a Custom choice) | proxy (a scheme dropdown and an address)
// scale: multiplies a number into the API's unit (for example MB to bytes).
// types: file dialog filters for a local path, which also adds a Browse button.
// local: refers to a file on this machine; only shown when the API allows it.
// noDefault: never saved as a default (logins and passwords).
// defaultsOnly: only in the defaults editor; the new-download form has its own control.
// offWith: another field that, once ticked, switches this one off and leaves it out of the request.
// group: a sub-section of its section; fields sharing one are drawn together under a collapsible heading.
// filter: narrows the streams, so it is ignored once a single stream is picked.
// tracks: only shown when the stream has such tracks (names the stream choices that show it).
// presets: the name of a list in `PRESETS`, which becomes the dropdown's values.
// options: the name of a list in `CHOICES`, which becomes the select's values.
//
// The list itself is in data/options-sections.json.

import sections from './data/options-sections.json';
import proxySchemes from './data/proxy-schemes.json';
import codecs from './data/codecs.json';
import outputFormats from './data/output-formats.json';
import qualities from './data/qualities.json';
import remuxBackends from './data/remux-backends.json';
import storageStrategies from './data/storage-strategies.json';
import USER_AGENTS from './data/user-agents.json';
import videoRanges from './data/video-ranges.json';

/**
 * @typedef {object} Field
 * @property {string} key
 * @property {string} label
 * @property {string} type
 * @property {string} [hint]
 * @property {number} [scale]
 * @property {string[]} [types]
 * @property {string[]} [options]
 * @property {{ label: string, value: string }[]} [presets]
 * @property {string[]} [tracks]
 * @property {string} [pairs]
 * @property {string} [group]
 * @property {string} [offWith]
 * @property {boolean} [local]
 * @property {boolean} [filter]
 * @property {boolean} [noDefault]
 * @property {boolean} [defaultsOnly]
 * @property {boolean} [fallback]
 */
/** @typedef {{ id: string, title: string, fields: Field[] }} Section */

/** The quality choices for a download, from best to worst. */
export const QUALITIES = /** @type {string[]} */ (qualities);

/** The address schemes a proxy can use, for the proxy field's dropdown. */
export const PROXY_SCHEMES = /** @type {string[]} */ (proxySchemes);

/** @type {Map<string, { label: string, value: string }[]>} */
const PRESETS = new Map([['user-agents', USER_AGENTS]]);

/** @type {Map<string, string[]>} */
const CHOICES = new Map([
  ['qualities', qualities],
  ['codecs', codecs],
  ['video-ranges', videoRanges],
  ['output-formats', outputFormats],
  ['remux-backends', remuxBackends],
  ['storage-strategies', storageStrategies],
]);

/** @type {{ id: string, title: string, fields: (Omit<Field, 'presets' | 'options'> & { presets?: string, options?: string })[] }[]} */
const listed = /** @type {any} */ (sections);

/** @type {Section[]} */
export const SECTIONS = listed.map((section) => ({
  ...section,
  fields: section.fields.map(({ presets, options, ...field }) => ({
    ...field,
    ...(presets && { presets: PRESETS.get(presets) }),
    ...(options && { options: CHOICES.get(options) }),
  })),
}));

/**
 * What a form holds under one field id, or undefined. Only its own entries count, so an id such as
 * `constructor` never reaches the object's prototype.
 * @param {Record<string, any> | undefined} record
 * @param {string} id
 */
export function lookup(record, id) {
  return record && Object.hasOwn(record, id) ? Reflect.get(record, id) : undefined;
}

/**
 * @param {Record<string, any>} target
 * @param {string} path
 * @param {unknown} value
 */
function setPath(target, path, value) {
  // The keys come from the option list above, never from the user. `Reflect` keeps the walk explicit.
  const parts = path.split('.');
  let node = target;
  for (const part of parts.slice(0, -1)) {
    if (!Reflect.has(node, part)) Reflect.set(node, part, {});
    node = Reflect.get(node, part);
  }
  Reflect.set(node, parts[parts.length - 1], value);
}

/**
 * @param {string} text
 * @param {string} separator
 */
function parsePairs(text, separator) {
  /** @type {Record<string, string>} */
  const result = {};
  for (const line of text.split('\n')) {
    const at = line.indexOf(separator);
    if (at > 0) result[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return result;
}

/**
 * The value of one field as the API wants it, or undefined if the user left it alone.
 * @param {{ type?: string, scale?: number, pairs?: string, fallback?: boolean }} field
 * @param {any} raw
 */
export function convert(field, raw) {
  if (raw === undefined || raw === '') return undefined;
  switch (field.type) {
    case 'number': {
      const number = Number(raw);
      return Number.isFinite(number)
        ? Math.round(number * (field.scale ?? 1) * 1000) / 1000
        : undefined;
    }
    case 'list': {
      const items = raw
        .split(',')
        .map((/** @type {string} */ item) => item.trim())
        .filter(Boolean);
      return items.length ? items : undefined;
    }
    case 'lines': {
      const pairs = parsePairs(raw, field.pairs ?? ':');
      return Object.keys(pairs).length ? pairs : undefined;
    }
    case 'bool':
      // Sent as it is, so a box can switch off something a saved default switched on.
      return Boolean(raw);
    default:
      return raw;
  }
}

/**
 * Builds the section objects of a download request from what the form holds.
 * @param {Record<string, any>} values
 */
export function buildOptions(values) {
  /** @type {Record<string, any>} */
  const request = {};
  for (const section of SECTIONS) {
    /** @type {Record<string, any>} */
    const body = {};
    for (const field of section.fields) {
      if (field.offWith && values[`${section.id}.${field.offWith}`]) continue;
      const value = convert(field, values[`${section.id}.${field.key}`]);
      if (value !== undefined) setPath(body, field.key, value);
    }
    if (Object.keys(body).length) request[section.id] = body;
  }
  return request;
}

/**
 * Builds the source part: one address, several, or playlist text with its base address.
 * @param {string} mode
 * @param {{ url: string, urls: string, text: string, base: string }} input
 */
export function buildSource(mode, input) {
  if (mode === 'many') {
    const urls = input.urls
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
    return { urls };
  }
  if (mode === 'text') return { playlist_text: input.text, base_url: input.base.trim() };
  return { url: input.url.trim() };
}

/**
 * What an inspected master playlist offers, as dropdown choices for the stream selection fields.
 * Only fields the stream has something to choose for are included.
 * @param {{ variants?: any[], audio_tracks?: any[], subtitle_tracks?: any[] }} playlist
 * @returns {Record<string, { value: string, label: string }[]>}
 */
export function streamChoices(playlist) {
  const variants = playlist.variants ?? [];
  /** @param {(string | number | null | undefined)[]} items */
  const distinct = (items) => [...new Set(items.filter((item) => item != null && item !== ''))];
  const heights = distinct(variants.map((v) => Number(v.resolution?.split('x')[1]) || null)).sort(
    (a, b) => Number(b) - Number(a),
  );
  /** @param {string | null | undefined} size */
  const pixels = (size) =>
    (size ?? '').split('x').reduce((area, side) => area * (Number(side) || 0), 1);
  const kbps = distinct(variants.map((v) => v.bandwidth && Math.round(v.bandwidth / 1000))).sort(
    (a, b) => Number(b) - Number(a),
  );
  /** @param {(string | number | null | undefined)[]} items */
  const plain = (items) =>
    distinct(items).map((item) => ({ value: String(item), label: String(item) }));
  const bitrates = kbps.map((k) => ({ value: String(k), label: `${k} kbps` }));
  const choices = {
    'selection.variant': variants.map((v) => ({
      value: String(v.index),
      label: [
        `#${v.index}`,
        v.resolution ?? v.name,
        v.bandwidth && `${Math.round(v.bandwidth / 1000)} kbps`,
      ]
        .filter(Boolean)
        .join(' · '),
    })),
    'selection.resolution': plain(
      variants.map((v) => v.resolution).sort((a, b) => pixels(b) - pixels(a)),
    ),
    'selection.max_resolution': heights.map((h) => ({ value: `${h}p`, label: `${h}p` })),
    'selection.bandwidth': bitrates,
    'selection.max_bitrate': bitrates,
    'selection.audio_names': plain((playlist.audio_tracks ?? []).map((t) => t.name)),
    'selection.subtitle_names': plain((playlist.subtitle_tracks ?? []).map((t) => t.name)),
  };
  return Object.fromEntries(Object.entries(choices).filter(([, list]) => list.length > 0));
}

/**
 * What the form holds for a saved value.
 * @param {Field} field
 * @param {any} raw
 */
function shown(field, raw) {
  switch (field.type) {
    case 'bool':
      return Boolean(raw);
    case 'list':
      return raw.join(', ');
    case 'lines':
      return Object.entries(raw)
        .map(([name, value]) => `${name}${field.pairs ?? ':'} ${value}`)
        .join('\n');
    case 'number':
      return String(raw / (field.scale ?? 1));
    default:
      return String(raw);
  }
}

/**
 * @param {Record<string, any> | undefined} source
 * @param {string} path
 */
function getPath(source, path) {
  return path
    .split('.')
    .reduce((node, part) => (node == null ? undefined : Reflect.get(node, part)), source);
}

/**
 * The reverse of buildOptions: turns saved defaults into the form's flat values.
 * @param {Record<string, any>} [nested]
 * @returns {Record<string, any>}
 */
export function toValues(nested = {}) {
  /** @type {Record<string, any>} */
  const values = {};
  for (const section of SECTIONS) {
    for (const field of section.fields) {
      const raw = getPath(lookup(nested, section.id), field.key);
      if (raw === undefined || raw === null) continue;
      const id = `${section.id}.${field.key}`;
      Reflect.set(values, id, shown(field, raw));
    }
  }
  return values;
}
