<?php
/**
 * Turn uploaded content (Word .docx, Markdown, plain text, HTML) into a
 * studio document body. Used by the MCP connector; the app has its own,
 * richer converter for uploads made in the browser.
 */

if (!defined('ABSPATH')) {
	exit;
}

class SMS_Import {
	private static function esc($s) {
		return str_replace(array('&', '<', '>'), array('&amp;', '&lt;', '&gt;'), (string) $s);
	}

	/** Plain text: blank lines separate paragraphs, single newlines become line breaks. */
	public static function text_to_html($text) {
		$text  = str_replace(array("\r\n", "\r"), "\n", (string) $text);
		$paras = preg_split("/\n\s*\n/", trim($text));
		$out   = array();
		foreach ($paras as $p) {
			if ('' === trim($p)) {
				continue;
			}
			$out[] = '<p>' . implode('<br>', array_map(array(__CLASS__, 'esc'), explode("\n", $p))) . '</p>';
		}
		return $out ? implode("\n", $out) : '<p><br></p>';
	}

	private static function md_inline($s) {
		$s = self::esc($s);
		$s = preg_replace('/\*\*(.+?)\*\*/u', '<strong>$1</strong>', $s);
		$s = preg_replace('/__(.+?)__/u', '<u>$1</u>', $s);
		$s = preg_replace('/(?<![*\w])\*(?!\s)(.+?)(?<!\s)\*(?![*\w])/u', '<em>$1</em>', $s);
		$s = preg_replace('/\[([^\]]+)\]\((https?:[^)\s]+)\)/u', '<a href="$2">$1</a>', $s);
		return $s;
	}

	/** A small Markdown subset: headings, bold, italic, lists, links, rules, paragraphs. */
	public static function markdown_to_html($md) {
		$lines = explode("\n", str_replace(array("\r\n", "\r"), "\n", (string) $md));
		$out   = array();
		$para  = array();
		$list  = null;
		$flush = function () use (&$out, &$para, &$list) {
			if ($para) {
				$out[] = '<p>' . implode('<br>', $para) . '</p>';
				$para  = array();
			}
			if ($list) {
				$out[] = '<' . $list[0] . '>' . implode('', array_map(function ($i) { return '<li>' . $i . '</li>'; }, $list[1])) . '</' . $list[0] . '>';
				$list  = null;
			}
		};
		foreach ($lines as $line) {
			if ('' === trim($line)) {
				$flush();
				continue;
			}
			if (preg_match('/^(#{1,3})\s+(.*)$/', $line, $m)) {
				$flush();
				$out[] = '<h' . strlen($m[1]) . '>' . self::md_inline($m[2]) . '</h' . strlen($m[1]) . '>';
			} elseif (preg_match('/^\s*(---+|\*\*\*+)\s*$/', $line)) {
				$flush();
				$out[] = '<hr>';
			} elseif (preg_match('/^\s*[-*+]\s+(.*)$/', $line, $m) || preg_match('/^\s*\d+[.)]\s+(.*)$/', $line, $m)) {
				$tag = preg_match('/^\s*\d/', $line) ? 'ol' : 'ul';
				if ($para) {
					$out[] = '<p>' . implode('<br>', $para) . '</p>';
					$para  = array();
				}
				if (!$list || $list[0] !== $tag) {
					if ($list) {
						$flush();
					}
					$list = array($tag, array());
				}
				$list[1][] = self::md_inline($m[1]);
			} else {
				if ($list) {
					$flush();
				}
				$para[] = self::md_inline($line);
			}
		}
		$flush();
		return $out ? implode("\n", $out) : '<p><br></p>';
	}

	/* ---------- Word (.docx) ---------- */

	const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

	private static function w_attr($el, $name) {
		return $el ? $el->getAttributeNS(self::W, $name) : '';
	}

	private static function child($el, $name) {
		if (!$el) {
			return null;
		}
		foreach ($el->childNodes as $c) {
			if (XML_ELEMENT_NODE === $c->nodeType && $c->namespaceURI === self::W && $c->localName === $name) {
				return $c;
			}
		}
		return null;
	}

	private static function on($el) {
		if (!$el) {
			return false;
		}
		$v = self::w_attr($el, 'val');
		return '' === $v || !in_array(strtolower($v), array('0', 'false', 'none'), true);
	}

	private static function run_html($r, &$boxes) {
		$rpr   = self::child($r, 'rPr');
		$style = array();
		if ($rpr) {
			$fonts = self::child($rpr, 'rFonts');
			$font  = $fonts ? ($fonts->getAttributeNS(self::W, 'cs') ?: $fonts->getAttributeNS(self::W, 'ascii') ?: $fonts->getAttributeNS(self::W, 'hAnsi')) : '';
			if ($font) {
				$style[] = "font-family: '" . str_replace(array('"', "'", ';', '<', '>'), '', $font) . "'";
			}
			$sz = self::child($rpr, 'szCs') ?: self::child($rpr, 'sz');
			if ($sz && is_numeric(self::w_attr($sz, 'val'))) {
				$style[] = 'font-size: ' . ((int) self::w_attr($sz, 'val') / 2) . 'pt';
			}
			$color = self::child($rpr, 'color');
			if ($color && preg_match('/^[0-9A-Fa-f]{6}$/', self::w_attr($color, 'val')) && '000000' !== self::w_attr($color, 'val')) {
				$style[] = 'color: #' . strtolower(self::w_attr($color, 'val'));
			}
			if (self::on(self::child($rpr, 'b')) || self::on(self::child($rpr, 'bCs'))) {
				$style[] = 'font-weight: bold';
			}
			if (self::on(self::child($rpr, 'i'))) {
				$style[] = 'font-style: italic';
			}
			$u = self::child($rpr, 'u');
			if ($u && 'none' !== self::w_attr($u, 'val')) {
				$style[] = 'text-decoration: underline';
			}
		}
		$text = '';
		foreach ($r->childNodes as $c) {
			if (XML_ELEMENT_NODE !== $c->nodeType) {
				continue;
			}
			if ('t' === $c->localName) {
				$text .= self::esc($c->textContent);
			} elseif ('tab' === $c->localName) {
				$text .= '&emsp;';
			} elseif ('br' === $c->localName || 'cr' === $c->localName) {
				$text .= '<br>';
			}
		}
		// Text boxes inside the run: keep their paragraphs, shown after this paragraph.
		$xp = new DOMXPath($r->ownerDocument);
		$xp->registerNamespace('w', self::W);
		foreach ($xp->query('.//w:txbxContent', $r) as $tb) {
			$inner = array();
			foreach ($tb->childNodes as $p) {
				if (XML_ELEMENT_NODE === $p->nodeType && 'p' === $p->localName) {
					$inner[] = self::para_html($p, $boxes);
				}
			}
			$boxes[] = '<div class="sv-textbox" style="box-sizing: border-box; padding: 4pt 7pt; border: 1px solid #a1a1aa; margin: 6pt 0;">' . implode('', $inner) . '</div>';
			break; // AlternateContent repeats the box as a fallback.
		}
		if ('' === $text) {
			return '';
		}
		return $style ? '<span style="' . htmlspecialchars(implode('; ', $style) . ';', ENT_COMPAT, 'UTF-8') . '">' . $text . '</span>' : $text;
	}

	private static function para_html($p, &$boxes) {
		$ppr   = self::child($p, 'pPr');
		$style = array();
		$tag   = 'p';
		if ($ppr) {
			$jc = self::child($ppr, 'jc');
			$al = array('center' => 'center', 'right' => 'right', 'end' => 'right', 'both' => 'justify', 'distribute' => 'justify');
			if ($jc && isset($al[self::w_attr($jc, 'val')])) {
				$style[] = 'text-align: ' . $al[self::w_attr($jc, 'val')];
			}
			$ps = self::child($ppr, 'pStyle');
			if ($ps && preg_match('/^Heading([1-3])$/i', self::w_attr($ps, 'val'), $hm)) {
				$tag = 'h' . $hm[1];
			}
		}
		$html = '';
		foreach ($p->childNodes as $c) {
			if (XML_ELEMENT_NODE !== $c->nodeType) {
				continue;
			}
			if ('r' === $c->localName) {
				$html .= self::run_html($c, $boxes);
			} elseif ('hyperlink' === $c->localName || 'smartTag' === $c->localName || 'ins' === $c->localName) {
				foreach ($c->childNodes as $r) {
					if (XML_ELEMENT_NODE === $r->nodeType && 'r' === $r->localName) {
						$html .= self::run_html($r, $boxes);
					}
				}
			}
		}
		return '<' . $tag . ($style ? ' style="' . implode('; ', $style) . ';"' : '') . '>' . ('' === $html ? '<br>' : $html) . '</' . $tag . '>';
	}

	private static function block_html($el, &$out) {
		foreach ($el->childNodes as $c) {
			if (XML_ELEMENT_NODE !== $c->nodeType) {
				continue;
			}
			if ('p' === $c->localName) {
				$boxes = array();
				$out[] = self::para_html($c, $boxes);
				foreach ($boxes as $b) {
					$out[] = $b;
				}
			} elseif ('tbl' === $c->localName) {
				$rows = array();
				foreach ($c->childNodes as $tr) {
					if (XML_ELEMENT_NODE !== $tr->nodeType || 'tr' !== $tr->localName) {
						continue;
					}
					$cells = array();
					foreach ($tr->childNodes as $tc) {
						if (XML_ELEMENT_NODE === $tc->nodeType && 'tc' === $tc->localName) {
							$inner = array();
							self::block_html($tc, $inner);
							$cells[] = '<td>' . implode('', $inner) . '</td>';
						}
					}
					$rows[] = '<tr>' . implode('', $cells) . '</tr>';
				}
				$out[] = '<table style="border-collapse:collapse;width:100%">' . implode('', $rows) . '</table>';
			} elseif ('sdt' === $c->localName) {
				$content = self::child($c, 'sdtContent');
				if ($content) {
					self::block_html($content, $out);
				}
			}
		}
	}

	/** Returns array('html' => body, 'margins' => array|null) or WP_Error. */
	public static function docx_to_html($bytes) {
		if (!class_exists('ZipArchive')) {
			return new WP_Error('sms_no_zip', 'This server cannot open Word files (PHP zip extension missing). Send the text or HTML instead.');
		}
		$tmp = wp_tempnam('sms-docx');
		file_put_contents($tmp, $bytes);
		$zip = new ZipArchive();
		if (true !== $zip->open($tmp)) {
			@unlink($tmp);
			return new WP_Error('sms_bad_docx', 'This is not a valid .docx file.');
		}
		$xml = $zip->getFromName('word/document.xml');
		$zip->close();
		@unlink($tmp);
		if (!$xml) {
			return new WP_Error('sms_bad_docx', 'The Word file has no document body.');
		}
		$dom  = new DOMDocument();
		$prev = libxml_use_internal_errors(true);
		$dom->loadXML($xml, LIBXML_NONET | LIBXML_COMPACT);
		libxml_use_internal_errors($prev);
		$body = $dom->getElementsByTagNameNS(self::W, 'body')->item(0);
		if (!$body) {
			return new WP_Error('sms_bad_docx', 'The Word file has no document body.');
		}
		$out = array();
		self::block_html($body, $out);
		$margins = null;
		$pg = $dom->getElementsByTagNameNS(self::W, 'pgMar')->item(0);
		if ($pg) {
			$in = function ($n) use ($pg) { $v = $pg->getAttributeNS(self::W, $n); return is_numeric($v) ? round((int) $v / 1440, 2) : 1; };
			$margins = array('top' => $in('top'), 'right' => $in('right'), 'bottom' => $in('bottom'), 'left' => $in('left'));
		}
		return array('html' => implode("\n", $out) ?: '<p><br></p>', 'margins' => $margins);
	}
}
