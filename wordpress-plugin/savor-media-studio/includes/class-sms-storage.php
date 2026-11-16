<?php
/**
 * File storage for Media Studio projects.
 *
 * Projects are JSON files under wp-content/uploads/savor-media-studio/files.
 * The whole folder is blocked from direct web access; everything goes
 * through the REST API, which only ever reads and writes validated .json files.
 */

if (!defined('ABSPATH')) {
	exit;
}

class SMS_Storage {
	const MAX_FILE_BYTES  = 4194304;   // 4 MB per project file.
	const MAX_TOTAL_BYTES = 314572800; // 300 MB for all files.
	const MAX_FILES       = 3000;
	const MAX_DEPTH       = 6;
	const VERSION_EVERY   = 300;       // Seconds between automatic version snapshots.
	const VERSIONS_KEPT   = 30;
	const TRASH_DAYS      = 30;

	private static $instance;
	private $root;

	public static function instance() {
		if (!self::$instance) {
			$uploads        = wp_upload_dir(null, false);
			self::$instance = new self(trailingslashit($uploads['basedir']) . 'savor-media-studio');
		}
		return self::$instance;
	}

	public function __construct($root) {
		$this->root = rtrim($root, '/\\');
	}

	public function files_dir() {
		return $this->root . '/files';
	}

	private function versions_dir() {
		return $this->root . '/versions';
	}

	private function trash_dir() {
		return $this->root . '/trash';
	}

	/** Create folders and lock them against direct web access. */
	public function ensure_dirs() {
		foreach (array($this->root, $this->files_dir(), $this->versions_dir(), $this->trash_dir()) as $dir) {
			if (!is_dir($dir)) {
				wp_mkdir_p($dir);
			}
		}
		$htaccess = $this->root . '/.htaccess';
		if (!file_exists($htaccess)) {
			file_put_contents($htaccess, "# SAVOR Media Studio: files are served only through the REST API.\n<IfModule mod_authz_core.c>\n\tRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n\tOrder allow,deny\n\tDeny from all\n</IfModule>\nOptions -Indexes\n");
		}
		foreach (array($this->root, $this->files_dir(), $this->versions_dir(), $this->trash_dir()) as $dir) {
			if (!file_exists($dir . '/index.php')) {
				file_put_contents($dir . '/index.php', "<?php\n// Silence is golden.\n");
			}
		}
	}

	/** First activation: start with one empty folder. */
	public function seed_if_empty() {
		if (!$this->list_tree()) {
			$this->mkdir_rel('Projects');
		}
	}

	/**
	 * Validate a relative path and return its clean form, or WP_Error.
	 * Segments may contain letters (any script, including Bangla), marks, digits,
	 * spaces and - _ . ( ) &. No dot files, no traversal.
	 */
	public static function clean_path($path, $kind = 'file') {
		if (!is_string($path)) {
			return new WP_Error('sms_bad_path', 'ফাইলের নাম সঠিক নয়।', array('status' => 400));
		}
		$path = str_replace('\\', '/', trim($path));
		$path = trim(preg_replace('#/+#', '/', $path), '/');
		if ('' === $path) {
			return 'folder' === $kind ? '' : new WP_Error('sms_bad_path', 'ফাইলের নাম দিন।', array('status' => 400));
		}
		$parts = explode('/', $path);
		if (count($parts) > self::MAX_DEPTH) {
			return new WP_Error('sms_bad_path', 'ফোল্ডারের গভীরতা বেশি।', array('status' => 400));
		}
		foreach ($parts as $part) {
			$part = trim($part);
			if ('' === $part || '.' === $part[0] || strlen($part) > 120 || !preg_match('/^[\p{L}\p{M}\p{N} _\-.()&]+$/u', $part)) {
				return new WP_Error('sms_bad_path', 'নামে শুধু অক্ষর, সংখ্যা, স্পেস ও - _ . ( ) & ব্যবহার করুন।', array('status' => 400));
			}
		}
		$clean = implode('/', array_map('trim', $parts));
		if ('file' === $kind && !preg_match('/\.json$/i', $clean)) {
			$clean .= '.json';
		}
		if ('folder' === $kind && preg_match('/\.json$/i', $clean)) {
			return new WP_Error('sms_bad_path', 'ফোল্ডারের নাম .json দিয়ে শেষ হতে পারে না।', array('status' => 400));
		}
		return $clean;
	}

	private function abs($rel) {
		return $this->files_dir() . ('' === $rel ? '' : '/' . $rel);
	}

	/** Flat list of all folders and files, sorted. */
	public function list_tree() {
		$base = $this->files_dir();
		if (!is_dir($base)) {
			return array();
		}
		$out = array();
		$it  = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::SELF_FIRST);
		foreach ($it as $info) {
			$name = $info->getFilename();
			if ('.' === $name[0] || 'index.php' === $name) {
				continue;
			}
			$rel = ltrim(str_replace('\\', '/', substr($info->getPathname(), strlen($base))), '/');
			if ($info->isDir()) {
				$out[] = array('path' => $rel, 'type' => 'folder', 'modified' => $info->getMTime());
			} elseif (preg_match('/\.json$/i', $name)) {
				$out[] = array('path' => $rel, 'type' => 'file', 'size' => $info->getSize(), 'modified' => $info->getMTime());
			}
		}
		usort($out, function ($a, $b) {
			return strnatcasecmp($a['path'], $b['path']);
		});
		return $out;
	}

	public function read($rel) {
		$file = $this->abs($rel);
		if (!is_file($file)) {
			return new WP_Error('sms_not_found', 'ফাইলটি পাওয়া যায়নি।', array('status' => 404));
		}
		$raw = file_get_contents($file);
		$data = json_decode($raw, true);
		return array(
			'path'     => $rel,
			'content'  => is_array($data) ? $data : null,
			'etag'     => md5($raw),
			'modified' => filemtime($file),
		);
	}

	private function usage() {
		$bytes = 0;
		$count = 0;
		foreach ($this->list_tree() as $item) {
			if ('file' === $item['type']) {
				$bytes += $item['size'];
				$count++;
			}
		}
		return array($bytes, $count);
	}

	/**
	 * Save JSON content. $etag (optional) guards against overwriting someone
	 * else's newer save. $mode: 'save' (create or update), 'create' (fail if exists).
	 */
	public function write($rel, $content, $etag = null, $mode = 'save') {
		$json = wp_json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
		if (false === $json) {
			return new WP_Error('sms_bad_content', 'ফাইলের তথ্য সঠিক নয়।', array('status' => 400));
		}
		if (strlen($json) > self::MAX_FILE_BYTES) {
			return new WP_Error('sms_too_big', 'ফাইলটি অনেক বড় (সর্বোচ্চ ৪ MB)।', array('status' => 413));
		}
		$file   = $this->abs($rel);
		$exists = is_file($file);
		if ($exists && 'create' === $mode) {
			return new WP_Error('sms_exists', 'এই নামে ফাইল আগে থেকেই আছে।', array('status' => 409));
		}
		if ($exists && $etag) {
			$current = md5_file($file);
			if ($current !== $etag) {
				return new WP_Error('sms_conflict', 'ফাইলটি অন্য কোথাও থেকে বদলানো হয়েছে।', array('status' => 409, 'etag' => $current));
			}
		}
		list($bytes, $count) = $this->usage();
		if (!$exists && $count >= self::MAX_FILES) {
			return new WP_Error('sms_quota', 'ফাইলের সংখ্যা সীমা পূর্ণ।', array('status' => 507));
		}
		if ($bytes + strlen($json) - ($exists ? filesize($file) : 0) > self::MAX_TOTAL_BYTES) {
			return new WP_Error('sms_quota', 'স্টোরেজ সীমা পূর্ণ। পুরনো ফাইল মুছুন।', array('status' => 507));
		}
		$dir = dirname($file);
		if (!is_dir($dir)) {
			return new WP_Error('sms_no_folder', 'ফোল্ডারটি পাওয়া যায়নি।', array('status' => 404));
		}
		if ($exists) {
			$this->maybe_snapshot($rel, $file);
		}
		$tmp = $file . '.tmp-' . wp_generate_password(8, false);
		if (false === file_put_contents($tmp, $json, LOCK_EX) || !@rename($tmp, $file)) {
			@unlink($tmp);
			return new WP_Error('sms_write_failed', 'সার্ভারে সেভ করা যায়নি।', array('status' => 500));
		}
		clearstatcache(true, $file);
		return array('path' => $rel, 'etag' => md5($json), 'modified' => filemtime($file), 'size' => strlen($json));
	}

	public function mkdir_rel($rel) {
		$dir = $this->abs($rel);
		if (file_exists($dir)) {
			return new WP_Error('sms_exists', 'এই নামে ফোল্ডার বা ফাইল আগে থেকেই আছে।', array('status' => 409));
		}
		if (!is_dir(dirname($dir))) {
			return new WP_Error('sms_no_folder', 'উপরের ফোল্ডারটি পাওয়া যায়নি।', array('status' => 404));
		}
		if (!wp_mkdir_p($dir)) {
			return new WP_Error('sms_write_failed', 'ফোল্ডার তৈরি করা যায়নি।', array('status' => 500));
		}
		return array('path' => $rel, 'type' => 'folder');
	}

	public function move($from, $to) {
		$a = $this->abs($from);
		$b = $this->abs($to);
		if (!file_exists($a)) {
			return new WP_Error('sms_not_found', 'ফাইলটি পাওয়া যায়নি।', array('status' => 404));
		}
		if (file_exists($b)) {
			return new WP_Error('sms_exists', 'এই নামে ফাইল বা ফোল্ডার আগে থেকেই আছে।', array('status' => 409));
		}
		if (is_dir($a) && 0 === strpos($to . '/', $from . '/')) {
			return new WP_Error('sms_bad_path', 'ফোল্ডারকে তার নিজের ভেতরে সরানো যায় না।', array('status' => 400));
		}
		if (!is_dir(dirname($b))) {
			return new WP_Error('sms_no_folder', 'গন্তব্য ফোল্ডারটি পাওয়া যায়নি।', array('status' => 404));
		}
		$moved_versions = array();
		if (is_file($a)) {
			$moved_versions[] = array($from, $to);
		} else {
			foreach ($this->list_tree() as $item) {
				if ('file' === $item['type'] && 0 === strpos($item['path'], $from . '/')) {
					$moved_versions[] = array($item['path'], $to . substr($item['path'], strlen($from)));
				}
			}
		}
		if (!@rename($a, $b)) {
			return new WP_Error('sms_write_failed', 'নাম বদলানো যায়নি।', array('status' => 500));
		}
		foreach ($moved_versions as $pair) {
			$va = $this->version_dir_for($pair[0]);
			$vb = $this->version_dir_for($pair[1]);
			if (is_dir($va) && !file_exists($vb)) {
				@rename($va, $vb);
			}
		}
		return array('from' => $from, 'to' => $to);
	}

	/** Deleting moves the item into trash/ so it can be recovered for 30 days. */
	public function trash($rel) {
		$src = $this->abs($rel);
		if ('' === $rel || !file_exists($src)) {
			return new WP_Error('sms_not_found', 'ফাইলটি পাওয়া যায়নি।', array('status' => 404));
		}
		$this->purge_trash();
		$dest = $this->trash_dir() . '/' . gmdate('Ymd-His') . '__' . str_replace('/', '__', $rel);
		if (!@rename($src, $dest)) {
			return new WP_Error('sms_write_failed', 'মুছে ফেলা যায়নি।', array('status' => 500));
		}
		return array('path' => $rel, 'trashed' => true);
	}

	private function purge_trash() {
		$cutoff = time() - self::TRASH_DAYS * DAY_IN_SECONDS;
		foreach ((array) glob($this->trash_dir() . '/*') as $item) {
			if ('index.php' !== basename($item) && filemtime($item) < $cutoff) {
				$this->rrmdir($item);
			}
		}
	}

	private function rrmdir($path) {
		if (is_dir($path)) {
			foreach ((array) scandir($path) as $name) {
				if ('.' !== $name && '..' !== $name) {
					$this->rrmdir($path . '/' . $name);
				}
			}
			@rmdir($path);
		} else {
			@unlink($path);
		}
	}

	/* ---- Versions ---- */

	private function version_dir_for($rel) {
		return $this->versions_dir() . '/' . md5(strtolower($rel));
	}

	private function maybe_snapshot($rel, $file) {
		$dir      = $this->version_dir_for($rel);
		$existing = is_dir($dir) ? (array) glob($dir . '/*.json') : array();
		sort($existing);
		$last = end($existing);
		if ($last && time() - filemtime($last) < self::VERSION_EVERY) {
			return;
		}
		if (!is_dir($dir)) {
			wp_mkdir_p($dir);
		}
		@copy($file, $dir . '/' . gmdate('Ymd-His') . '.json');
		$existing = (array) glob($dir . '/*.json');
		sort($existing);
		while (count($existing) > self::VERSIONS_KEPT) {
			@unlink(array_shift($existing));
		}
	}

	public function versions($rel) {
		$dir = $this->version_dir_for($rel);
		$out = array();
		foreach (is_dir($dir) ? (array) glob($dir . '/*.json') : array() as $file) {
			$out[] = array('id' => basename($file, '.json'), 'modified' => filemtime($file), 'size' => filesize($file));
		}
		usort($out, function ($a, $b) {
			return strcmp($b['id'], $a['id']);
		});
		return $out;
	}

	public function read_version($rel, $id) {
		if (!preg_match('/^\d{8}-\d{6}$/', (string) $id)) {
			return new WP_Error('sms_bad_version', 'ভার্সন সঠিক নয়।', array('status' => 400));
		}
		$file = $this->version_dir_for($rel) . '/' . $id . '.json';
		if (!is_file($file)) {
			return new WP_Error('sms_not_found', 'ভার্সনটি পাওয়া যায়নি।', array('status' => 404));
		}
		$data = json_decode(file_get_contents($file), true);
		return array('path' => $rel, 'id' => $id, 'content' => is_array($data) ? $data : null, 'modified' => filemtime($file));
	}
}
