<?php
/**
 * Project-level operations on the server: the same things the studio does in
 * the browser (documents, shared values flowing into every document), so the
 * MCP connector can do everything a person can.
 */

if (!defined('ABSPATH')) {
	exit;
}

class SMS_Project {
	const VALUES_FILE = 'project.json';
	const DOC_ORDER   = array('Invitation (Bangla).html', 'Invitation (English).html', 'Press Release (Bangla).html', 'Press Release (English).html');

	public static function store() {
		return SMS_Storage::instance();
	}

	/** Validate a project name (a top-level folder). */
	public static function clean_project($name) {
		$p = SMS_Storage::clean_path((string) $name, 'folder');
		if (is_wp_error($p)) {
			return $p;
		}
		if ('' === $p || false !== strpos($p, '/')) {
			return new WP_Error('sms_bad_project', 'Give a project name (no slashes).');
		}
		return $p;
	}

	public static function require_project($name) {
		$p = self::clean_project($name);
		if (is_wp_error($p)) {
			return $p;
		}
		if (!is_dir(self::store()->files_dir() . '/' . $p)) {
			return new WP_Error('sms_no_project', 'Project "' . $p . '" not found. Use list_projects to see the names.');
		}
		return $p;
	}

	public static function doc_path($project, $file) {
		$file = trim((string) $file);
		if ('' === $file || false !== strpos($file, '/')) {
			return new WP_Error('sms_bad_file', 'Give the document file name, e.g. "Invitation (English).html".');
		}
		return SMS_Storage::clean_path($project . '/' . $file, 'file');
	}

	/** All projects with their documents. */
	public static function projects() {
		$tree = self::store()->list_tree();
		$out  = array();
		foreach ($tree as $item) {
			if ('folder' === $item['type'] && false === strpos($item['path'], '/')) {
				$out[$item['path']] = array('name' => $item['path'], 'documents' => array(), 'has_shared_values' => false, 'modified' => gmdate('c', $item['modified']));
			}
		}
		foreach ($tree as $item) {
			if ('file' !== $item['type'] || 1 !== substr_count($item['path'], '/')) {
				continue;
			}
			list($proj, $file) = explode('/', $item['path'], 2);
			if (!isset($out[$proj])) {
				continue;
			}
			if (self::VALUES_FILE === $file) {
				$out[$proj]['has_shared_values'] = true;
			} else {
				$out[$proj]['documents'][] = $file;
			}
		}
		foreach ($out as &$p) {
			usort($p['documents'], array(__CLASS__, 'order'));
			$p['studio_url'] = self::studio_url($p['name']);
		}
		return array_values($out);
	}

	public static function order($a, $b) {
		$ia = array_search($a, self::DOC_ORDER, true);
		$ib = array_search($b, self::DOC_ORDER, true);
		$ia = false === $ia ? 100 : $ia;
		$ib = false === $ib ? 100 : $ib;
		return $ia === $ib ? strnatcasecmp($a, $b) : $ia - $ib;
	}

	public static function doc_files($project) {
		$files = array();
		foreach (self::store()->list_tree() as $item) {
			if ('file' === $item['type'] && 0 === strpos($item['path'], $project . '/') && 1 === substr_count($item['path'], '/') && preg_match('/\.html$/i', $item['path'])) {
				$files[] = substr($item['path'], strlen($project) + 1);
			}
		}
		usort($files, array(__CLASS__, 'order'));
		return $files;
	}

	public static function studio_url($project, $file = '') {
		return SMS_Frontend::url() . '#/p/' . rawurlencode($project) . ('' !== $file ? '/' . rawurlencode($file) : '');
	}

	/* ---------- Documents ---------- */

	public static function read_doc($project, $file) {
		$path = self::doc_path($project, $file);
		if (is_wp_error($path)) {
			return $path;
		}
		$r = self::store()->read($path);
		if (is_wp_error($r)) {
			return new WP_Error('sms_no_doc', 'Document "' . $file . '" not found in "' . $project . '". Documents: ' . implode(', ', self::doc_files($project)));
		}
		$model = SMS_Doc::parse($r['content'], preg_replace('/\.html$/i', '', basename($path)));
		return array('path' => $path, 'file' => basename($path), 'model' => $model, 'modified' => $r['modified']);
	}

	/** Save a document; shared values are written into its linked slots first. */
	public static function write_doc($project, $file, $model, $mode = 'save') {
		$path = self::doc_path($project, $file);
		if (is_wp_error($path)) {
			return $path;
		}
		$model['body'] = SMS_Storage::strip_active_content((string) $model['body']);
		$values = self::values($project);
		list($body) = SMS_Values::apply_to_body($model['body'], $model['lang'], $values);
		$model['body'] = '' !== trim($body) ? $body : '<p><br></p>';
		$r = self::store()->write($path, SMS_Doc::serialize($model), null, $mode);
		return is_wp_error($r) ? $r : array('file' => basename($path), 'saved' => true, 'modified' => gmdate('c', $r['modified']));
	}

	/* ---------- Shared values ---------- */

	public static function values($project) {
		$r = self::store()->read($project . '/' . self::VALUES_FILE);
		return is_wp_error($r) ? SMS_Values::parse('{"version":1}') : SMS_Values::parse($r['content']);
	}

	/** Save the values and write them into every document. Returns the documents that changed. */
	public static function save_values($project, $values) {
		$r = self::store()->write($project . '/' . self::VALUES_FILE, SMS_Values::to_json($values));
		if (is_wp_error($r)) {
			return $r;
		}
		$changed = array();
		foreach (self::doc_files($project) as $file) {
			$doc = self::read_doc($project, $file);
			if (is_wp_error($doc)) {
				continue;
			}
			list($body, $did) = SMS_Values::apply_to_body($doc['model']['body'], $doc['model']['lang'], $values);
			if ($did) {
				$doc['model']['body'] = $body;
				$w = self::store()->write($doc['path'], SMS_Doc::serialize($doc['model']));
				if (!is_wp_error($w)) {
					$changed[] = $file;
				}
			}
		}
		return $changed;
	}

	/* ---------- Projects ---------- */

	public static function create($name, $template) {
		$p = self::clean_project($name);
		if (is_wp_error($p)) {
			return $p;
		}
		$r = self::store()->mkdir_rel($p);
		if (is_wp_error($r)) {
			return $r;
		}
		$docs = array();
		if ('standard' === $template) {
			$t = json_decode((string) file_get_contents(SMS_DIR . 'data/templates.json'), true);
			foreach ((array) $t as $d) {
				$docs[$d['file']] = array('title' => $d['title'], 'lang' => $d['lang'], 'margins' => $d['margins'], 'font' => $d['font'], 'fontSize' => $d['fontSize'], 'body' => $d['body']);
			}
		} elseif ('blank' === $template) {
			$titles = array('Invitation (Bangla).html' => array('মিডিয়া ইনভিটেশন', 'bn'), 'Invitation (English).html' => array('Media Invitation', 'en'), 'Press Release (Bangla).html' => array('সংবাদ বিজ্ঞপ্তি', 'bn'), 'Press Release (English).html' => array('Press Release', 'en'));
			foreach ($titles as $file => $info) {
				$docs[$file] = SMS_Doc::empty_doc($info[0], $info[1]);
			}
		}
		self::store()->write($p . '/' . self::VALUES_FILE, SMS_Values::to_json(SMS_Values::parse('{"version":1}')));
		foreach ($docs as $file => $model) {
			self::store()->write($p . '/' . $file, SMS_Doc::serialize($model), null, 'create');
		}
		return array('project' => $p, 'documents' => array_keys($docs), 'studio_url' => self::studio_url($p));
	}
}
