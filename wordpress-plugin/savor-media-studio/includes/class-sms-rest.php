<?php
/**
 * REST API: /wp-json/savor-media-studio/v1/...
 *
 * Public by design (the studio has no login), so every route is rate limited,
 * writes are same-site only, and storage accepts nothing but validated JSON
 * project files inside the protected studio folder.
 */

if (!defined('ABSPATH')) {
	exit;
}

class SMS_Rest {
	const NS = 'savor-media-studio/v1';

	public static function init() {
		add_action('rest_api_init', array(__CLASS__, 'routes'));
	}

	public static function routes() {
		$read  = function () {
			return SMS_Limits::hit('read');
		};
		$write = function (WP_REST_Request $request) {
			$site = SMS_Limits::same_site($request);
			if (is_wp_error($site)) {
				return $site;
			}
			return SMS_Limits::hit('write');
		};

		register_rest_route(self::NS, '/files', array(
			'methods'             => 'GET',
			'callback'            => array(__CLASS__, 'list_files'),
			'permission_callback' => $read,
		));
		register_rest_route(self::NS, '/file', array(
			array(
				'methods'             => 'GET',
				'callback'            => array(__CLASS__, 'get_file'),
				'permission_callback' => $read,
			),
			array(
				'methods'             => 'PUT',
				'callback'            => array(__CLASS__, 'put_file'),
				'permission_callback' => $write,
			),
			array(
				'methods'             => 'DELETE',
				'callback'            => array(__CLASS__, 'delete_item'),
				'permission_callback' => $write,
			),
		));
		register_rest_route(self::NS, '/folder', array(
			'methods'             => 'POST',
			'callback'            => array(__CLASS__, 'create_folder'),
			'permission_callback' => $write,
		));
		register_rest_route(self::NS, '/move', array(
			'methods'             => 'POST',
			'callback'            => array(__CLASS__, 'move'),
			'permission_callback' => $write,
		));
		register_rest_route(self::NS, '/versions', array(
			'methods'             => 'GET',
			'callback'            => array(__CLASS__, 'versions'),
			'permission_callback' => $read,
		));
		register_rest_route(self::NS, '/version', array(
			'methods'             => 'GET',
			'callback'            => array(__CLASS__, 'version'),
			'permission_callback' => $read,
		));
		register_rest_route(self::NS, '/translate', array(
			'methods'             => 'POST',
			'callback'            => array(__CLASS__, 'translate'),
			'permission_callback' => function (WP_REST_Request $request) {
				$site = SMS_Limits::same_site($request);
				if (is_wp_error($site)) {
					return $site;
				}
				return SMS_Limits::hit('translate', max(1, (int) sms_settings()['translate_hourly']));
			},
		));
	}

	private static function storage() {
		$s = SMS_Storage::instance();
		$s->ensure_dirs();
		return $s;
	}

	private static function respond($result, $status = 200) {
		if (is_wp_error($result)) {
			return $result;
		}
		$response = new WP_REST_Response($result, $status);
		$response->header('Cache-Control', 'no-store');
		$response->header('X-Robots-Tag', 'noindex, nofollow');
		return $response;
	}

	public static function list_files() {
		return self::respond(array('items' => self::storage()->list_tree()));
	}

	public static function get_file(WP_REST_Request $request) {
		$path = SMS_Storage::clean_path($request->get_param('path'));
		if (is_wp_error($path)) {
			return $path;
		}
		return self::respond(self::storage()->read($path));
	}

	public static function put_file(WP_REST_Request $request) {
		$body = $request->get_json_params();
		$path = SMS_Storage::clean_path($body['path'] ?? null);
		if (is_wp_error($path)) {
			return $path;
		}
		if (!isset($body['content']) || !is_array($body['content'])) {
			return new WP_Error('sms_bad_content', 'ফাইলের তথ্য সঠিক নয়।', array('status' => 400));
		}
		$mode = (isset($body['mode']) && 'create' === $body['mode']) ? 'create' : 'save';
		$etag = isset($body['etag']) && is_string($body['etag']) && preg_match('/^[a-f0-9]{32}$/', $body['etag']) ? $body['etag'] : null;
		return self::respond(self::storage()->write($path, $body['content'], $etag, $mode));
	}

	public static function delete_item(WP_REST_Request $request) {
		$raw  = (string) $request->get_param('path');
		$kind = preg_match('/\.json$/i', $raw) ? 'file' : 'folder';
		$path = SMS_Storage::clean_path($raw, $kind);
		if (is_wp_error($path)) {
			return $path;
		}
		if ('' === $path) {
			return new WP_Error('sms_bad_path', 'মূল ফোল্ডার মুছা যায় না।', array('status' => 400));
		}
		return self::respond(self::storage()->trash($path));
	}

	public static function create_folder(WP_REST_Request $request) {
		$body = $request->get_json_params();
		$path = SMS_Storage::clean_path($body['path'] ?? null, 'folder');
		if (is_wp_error($path)) {
			return $path;
		}
		if ('' === $path) {
			return new WP_Error('sms_bad_path', 'ফোল্ডারের নাম দিন।', array('status' => 400));
		}
		return self::respond(self::storage()->mkdir_rel($path), 201);
	}

	public static function move(WP_REST_Request $request) {
		$body = $request->get_json_params();
		$from = (string) ($body['from'] ?? '');
		$kind = preg_match('/\.json$/i', $from) ? 'file' : 'folder';
		$a    = SMS_Storage::clean_path($from, $kind);
		$b    = SMS_Storage::clean_path($body['to'] ?? null, $kind);
		if (is_wp_error($a)) {
			return $a;
		}
		if (is_wp_error($b)) {
			return $b;
		}
		if ('' === $a || '' === $b) {
			return new WP_Error('sms_bad_path', 'নাম দিন।', array('status' => 400));
		}
		return self::respond(self::storage()->move($a, $b));
	}

	public static function versions(WP_REST_Request $request) {
		$path = SMS_Storage::clean_path($request->get_param('path'));
		if (is_wp_error($path)) {
			return $path;
		}
		return self::respond(array('path' => $path, 'versions' => self::storage()->versions($path)));
	}

	public static function version(WP_REST_Request $request) {
		$path = SMS_Storage::clean_path($request->get_param('path'));
		if (is_wp_error($path)) {
			return $path;
		}
		return self::respond(self::storage()->read_version($path, $request->get_param('id')));
	}

	public static function translate(WP_REST_Request $request) {
		if (SMS_Translate::passcode_required()) {
			$given = (string) $request->get_header('x-studio-passcode');
			if (!hash_equals((string) sms_settings()['gemini_passcode'], $given)) {
				return new WP_Error('sms_passcode', 'Gemini পাসকোড সঠিক নয়।', array('status' => 401, 'passcode' => true));
			}
		}
		$global = SMS_Limits::hit_global('translate', SMS_Translate::GLOBAL_DAILY);
		if (is_wp_error($global)) {
			return $global;
		}
		$body   = $request->get_json_params();
		$fields = SMS_Translate::validate_fields($body['fields'] ?? null);
		if (is_wp_error($fields)) {
			return $fields;
		}
		return self::respond(SMS_Translate::translate($fields));
	}
}
