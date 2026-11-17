<?php
/**
 * A studio document is a standalone, printable .html file. This mirrors the
 * app's src/editor/doc.ts (parse, serialize and the page CSS) so documents
 * changed on the server look exactly like documents saved by the app.
 */

if (!defined('ABSPATH')) {
	exit;
}

class SMS_Doc {
	const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;600;700&family=Noto+Serif+Bengali:wght@400;600;700&family=Tiro+Bangla:ital@0;1&family=Inter:wght@400;500;600;700&family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap';

	const FONTS = array(
		'Hind Siliguri'                     => "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
		'Noto Sans Bengali'                 => "'Noto Sans Bengali', 'Hind Siliguri', sans-serif",
		'Noto Serif Bengali'                => "'Noto Serif Bengali', 'Tiro Bangla', serif",
		'Tiro Bangla'                       => "'Tiro Bangla', 'Noto Serif Bengali', serif",
		'SutonnyMJ / Kalpurush (installed)' => "'Kalpurush', 'SutonnyMJ', 'Hind Siliguri', sans-serif",
		'Times New Roman'                   => "'Times New Roman', 'Noto Serif', 'Noto Serif Bengali', serif",
		'Inter'                             => "'Inter', 'Hind Siliguri', sans-serif",
		'Arial'                             => "Arial, 'Hind Siliguri', sans-serif",
		'Calibri'                           => "Calibri, Carlito, 'Hind Siliguri', sans-serif",
		'Georgia'                           => "Georgia, 'Noto Serif Bengali', serif",
	);

	public static function default_font($lang) {
		return 'bn' === $lang ? self::FONTS['Hind Siliguri'] : self::FONTS['Times New Roman'];
	}

	/** Numbers the way JavaScript prints them (1, 0.75). */
	public static function num($n) {
		$s = rtrim(rtrim(sprintf('%.6F', (float) $n), '0'), '.');
		return '' === $s || '-0' === $s ? '0' : $s;
	}

	public static function empty_doc($title, $lang, $body = '<p><br></p>') {
		return array(
			'title'    => $title,
			'lang'     => 'bn' === $lang ? 'bn' : 'en',
			'margins'  => array('top' => 1, 'right' => 1, 'bottom' => 1, 'left' => 1),
			'font'     => self::default_font($lang),
			'fontSize' => 12,
			'body'     => $body,
		);
	}

	public static function clamp_margin($v, $fallback) {
		if (!is_numeric($v)) {
			return $fallback;
		}
		return round(min(3, max(0, (float) $v)), 2);
	}

	public static function normalize_margins($m) {
		$m   = is_array($m) ? $m : array();
		$out = array();
		foreach (array('top', 'right', 'bottom', 'left') as $side) {
			$out[$side] = self::clamp_margin($m[$side] ?? null, 1);
		}
		$a4w = 210 / 25.4;
		$a4h = 297 / 25.4;
		if ($a4w - $out['left'] - $out['right'] < 2 || $a4h - $out['top'] - $out['bottom'] < 2) {
			return array('top' => 1, 'right' => 1, 'bottom' => 1, 'left' => 1);
		}
		return $out;
	}

	public static function css($model) {
		$m = $model['margins'];
		$pad = self::num($m['top']) . 'in ' . self::num($m['right']) . 'in ' . self::num($m['bottom']) . 'in ' . self::num($m['left']) . 'in';
		return '
:root{color-scheme:light}
html{background:#fff}
.sv-doc{font-family:' . $model['font'] . ';font-size:' . self::num($model['fontSize']) . 'pt;line-height:1.6;color:#111;background:#fff;word-wrap:break-word;overflow-wrap:break-word;-webkit-line-break:after-white-space}
body.sv-doc{box-sizing:border-box;margin:0 auto;max-width:210mm;min-height:297mm;padding:' . $pad . '}
.sv-doc p{margin:0 0 .55em}
.sv-doc h1{font-size:1.6em;line-height:1.25;margin:0 0 .5em}
.sv-doc h2{font-size:1.3em;line-height:1.3;margin:.8em 0 .45em}
.sv-doc h3{font-size:1.12em;margin:.7em 0 .4em}
.sv-doc ul,.sv-doc ol{margin:0 0 .6em;padding-left:1.6em}
.sv-doc li{margin:0 0 .2em}
.sv-doc blockquote{margin:0 0 .6em;padding-left:1em;border-left:3px solid #d4d4d8;color:#3f3f46}
.sv-doc table{border-collapse:collapse;width:100%;margin:0 0 .8em}
.sv-doc td,.sv-doc th{border:1px solid #a1a1aa;padding:4pt 6pt;vertical-align:top}
.sv-doc table.sv-plain td,.sv-doc table.sv-plain th{border:none}
.sv-doc img{max-width:100%;height:auto}
.sv-doc hr{border:none;border-top:1px solid #a1a1aa;margin:.8em 0}
.sv-doc a{color:#1d4ed8}
.sv-doc .sv-page-break{break-after:page;page-break-after:always;height:0;margin:0;border:none}
@page{size:A4;margin:' . $pad . '}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body.sv-doc{padding:0;max-width:none;min-height:0}.sv-doc p,.sv-doc li,.sv-doc h1,.sv-doc h2,.sv-doc h3,.sv-doc h4,.sv-doc blockquote,.sv-doc table,.sv-doc .sv-textbox,.sv-doc img{break-inside:avoid}}';
	}

	private static function esc($s) {
		return str_replace(array('&', '<', '>', '"'), array('&amp;', '&lt;', '&gt;', '&quot;'), (string) $s);
	}

	public static function serialize($model) {
		$m = $model['margins'];
		return '<!DOCTYPE html>
<html lang="' . $model['lang'] . '">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="SAVOR Media Studio">
<meta name="savor:margins" content="' . self::num($m['top']) . ' ' . self::num($m['right']) . ' ' . self::num($m['bottom']) . ' ' . self::num($m['left']) . '">
<meta name="savor:font" content="' . self::esc($model['font']) . '">
<meta name="savor:font-size" content="' . self::num($model['fontSize']) . '">
<title>' . self::esc($model['title']) . '</title>
<link rel="stylesheet" href="' . self::FONT_LINK . '">
<style>' . self::css($model) . '
</style>
</head>
<body class="sv-doc">
' . $model['body'] . '
</body>
</html>
';
	}

	private static function meta($html, $name) {
		if (preg_match('#<meta\s+name="' . preg_quote($name, '#') . '"\s+content="([^"]*)"#i', $html, $mm)) {
			return html_entity_decode($mm[1], ENT_QUOTES, 'UTF-8');
		}
		return '';
	}

	public static function guess_lang($text) {
		$letters = preg_replace('/[\s\d\p{P}]/u', '', (string) $text);
		if ('' === $letters) {
			return 'en';
		}
		$bn = preg_match_all('/[\x{0980}-\x{09FF}]/u', $letters);
		return $bn / max(1, mb_strlen($letters)) > 0.25 ? 'bn' : 'en';
	}

	/** Saved file → model. */
	public static function parse($html, $fallback_title = 'Untitled') {
		$body = $html;
		if (preg_match('#<body[^>]*>(.*)</body>#is', $html, $bm)) {
			$body = trim($bm[1]);
		} elseif (preg_match('#<html#i', $html)) {
			$body = '';
		}
		$title = '';
		if (preg_match('#<title>(.*?)</title>#is', $html, $tm)) {
			$title = trim(html_entity_decode($tm[1], ENT_QUOTES, 'UTF-8'));
		}
		$lang = '';
		if (preg_match('#<html[^>]*\blang="([^"]*)"#i', $html, $lm)) {
			$lang = strtolower($lm[1]);
		}
		$lang    = 0 === strpos($lang, 'bn') ? 'bn' : (0 === strpos($lang, 'en') ? 'en' : self::guess_lang(wp_strip_all_tags($body)));
		$parts   = preg_split('/\s+/', trim(self::meta($html, 'savor:margins')));
		$margins = 4 === count($parts) && count(array_filter($parts, 'is_numeric')) === 4
			? self::normalize_margins(array('top' => $parts[0], 'right' => $parts[1], 'bottom' => $parts[2], 'left' => $parts[3]))
			: array('top' => 1, 'right' => 1, 'bottom' => 1, 'left' => 1);
		$font = self::meta($html, 'savor:font');
		$size = (float) self::meta($html, 'savor:font-size');
		return array(
			'title'    => '' !== $title ? $title : $fallback_title,
			'lang'     => $lang,
			'margins'  => $margins,
			'font'     => ('' !== $font && !preg_match('/[;{}<>]|url\s*\(/i', $font)) ? $font : self::default_font($lang),
			'fontSize' => ($size >= 6 && $size <= 72) ? $size : 12,
			'body'     => '' !== trim($body) ? $body : '<p><br></p>',
		);
	}

	/* ---------- HTML fragments ---------- */

	/** Load a body fragment; returns array(DOMDocument, root element). */
	public static function load_fragment($html) {
		$dom = new DOMDocument('1.0', 'UTF-8');
		$prev = libxml_use_internal_errors(true);
		$dom->loadHTML('<!DOCTYPE html><html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head><body><div id="sms-root">' . $html . '</div></body></html>', LIBXML_HTML_NODEFDTD | LIBXML_NONET | LIBXML_COMPACT);
		libxml_clear_errors();
		libxml_use_internal_errors($prev);
		$root = $dom->getElementById('sms-root');
		if (!$root) {
			$xp   = new DOMXPath($dom);
			$root = $xp->query('//div[@id="sms-root"]')->item(0);
		}
		return array($dom, $root);
	}

	public static function inner_html($dom, $node) {
		$out = '';
		foreach ($node->childNodes as $child) {
			$out .= $dom->saveHTML($child);
		}
		return $out;
	}

	/** Replace a node's children with an HTML fragment. */
	public static function set_inner_html($dom, $node, $html) {
		while ($node->firstChild) {
			$node->removeChild($node->firstChild);
		}
		if ('' === $html) {
			return;
		}
		list($tmp, $root) = self::load_fragment($html);
		foreach (iterator_to_array($root->childNodes) as $child) {
			$node->appendChild($dom->importNode($child, true));
		}
	}

	/** Visible text of an HTML fragment. */
	public static function text($html) {
		$html = preg_replace('#<br\s*/?>#i', "\n", (string) $html);
		$html = preg_replace('#</(p|div|h[1-6]|li|tr|blockquote)>#i', "\n", $html);
		$text = html_entity_decode(wp_strip_all_tags($html, false), ENT_QUOTES | ENT_HTML5, 'UTF-8');
		$text = preg_replace("/[ \t\x{00A0}]+/u", ' ', $text);
		return trim(preg_replace("/\n\s*\n\s*\n+/", "\n\n", $text));
	}
}
