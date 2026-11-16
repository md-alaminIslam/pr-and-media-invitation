<?php
/**
 * Serves the built studio app at /{slug}/ (default /media-studio/).
 * Not linked anywhere, excluded from search engines, never cached.
 */

if (!defined('ABSPATH')) {
	exit;
}

class SMS_Frontend {
	public static function init() {
		add_action('parse_request', array(__CLASS__, 'maybe_serve'), 1);
	}

	/** Path of the current request relative to the WordPress home path. */
	private static function request_path() {
		$uri  = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '/';
		$path = (string) wp_parse_url($uri, PHP_URL_PATH);
		$home = (string) wp_parse_url(home_url('/'), PHP_URL_PATH);
		if ($home && '/' !== $home && 0 === strpos($path, $home)) {
			$path = substr($path, strlen($home));
		}
		return trim(rawurldecode($path), '/');
	}

	public static function slug() {
		$slug = trim((string) sms_settings()['slug'], '/');
		return '' === $slug ? 'media-studio' : $slug;
	}

	public static function url() {
		return home_url('/' . self::slug() . '/');
	}

	public static function maybe_serve() {
		$path = self::request_path();
		$slug = self::slug();
		if ($path !== $slug && $path !== $slug . '/index.html') {
			return;
		}
		// One canonical address (keeps browser-saved settings in one place).
		$home_host = wp_parse_url(home_url(), PHP_URL_HOST);
		$req_host  = isset($_SERVER['HTTP_HOST']) ? strtolower(sanitize_text_field(wp_unslash($_SERVER['HTTP_HOST']))) : $home_host;
		$uri       = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '';
		$has_slash = '/' === substr((string) wp_parse_url($uri, PHP_URL_PATH), -1);
		if (strtolower((string) $home_host) !== $req_host || (!$has_slash && $path === $slug)) {
			wp_safe_redirect(self::url(), 301);
			exit;
		}
		self::render();
		exit;
	}

	private static function render() {
		$index = SMS_DIR . 'app/index.html';
		nocache_headers();
		header('X-Robots-Tag: noindex, nofollow, noarchive', true);
		header('Referrer-Policy: same-origin', true);
		header('X-Content-Type-Options: nosniff', true);
		if (!is_readable($index)) {
			status_header(503);
			header('Content-Type: text/plain; charset=utf-8');
			echo 'SAVOR Media Studio: app files are missing. Reinstall the plugin from the GitHub release zip.';
			return;
		}
		status_header(200);
		header('Content-Type: text/html; charset=utf-8');

		$app_base = (string) wp_parse_url(SMS_URL . 'app/', PHP_URL_PATH);
		$config   = array(
			'restUrl'          => esc_url_raw(rest_url(SMS_Rest::NS . '/')),
			'version'          => SMS_VERSION,
			'gemini'           => SMS_Translate::available(),
			'geminiPasscode'   => SMS_Translate::passcode_required(),
			'pageUrl'          => self::url(),
		);
		$inject = '<base href="' . esc_attr($app_base) . '">'
			. '<meta name="robots" content="noindex, nofollow, noarchive">'
			. '<script>window.SAVOR_STUDIO=' . wp_json_encode($config) . ';</script>';

		$html = file_get_contents($index);
		$html = preg_replace_callback('/<head([^>]*)>/i', function ($m) use ($inject) {
			return $m[0] . $inject;
		}, $html, 1);
		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput -- built app shell from the plugin itself.
	}
}
