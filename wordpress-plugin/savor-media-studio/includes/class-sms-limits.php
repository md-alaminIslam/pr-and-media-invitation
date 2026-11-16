<?php
/**
 * Abuse protection for the public (no-login) API: per-IP rate limits and a
 * same-site check so other websites cannot write files from a visitor's browser.
 */

if (!defined('ABSPATH')) {
	exit;
}

class SMS_Limits {
	/** Requests allowed per IP per hour, by bucket. */
	const HOURLY = array(
		'read'  => 3000,
		'write' => 1500,
	);

	public static function client_ip() {
		return isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : 'unknown';
	}

	/** Returns true, or WP_Error (429) when the bucket is exhausted. */
	public static function hit($bucket, $limit = null) {
		$limit = $limit ? (int) $limit : (isset(self::HOURLY[$bucket]) ? self::HOURLY[$bucket] : 600);
		$key   = 'sms_rl_' . md5($bucket . '|' . self::client_ip() . '|' . gmdate('YmdH'));
		$count = (int) get_transient($key);
		if ($count >= $limit) {
			return new WP_Error('sms_rate_limited', 'অনেক বেশি অনুরোধ এসেছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।', array('status' => 429));
		}
		set_transient($key, $count + 1, HOUR_IN_SECONDS + 60);
		return true;
	}

	/** Site-wide daily cap (used for Gemini, which costs money). */
	public static function hit_global($bucket, $limit) {
		$key   = 'sms_rlg_' . md5($bucket . '|' . gmdate('Ymd'));
		$count = (int) get_transient($key);
		if ($count >= $limit) {
			return new WP_Error('sms_rate_limited', 'আজকের অনুবাদ সীমা শেষ। আগামীকাল আবার চেষ্টা করুন অথবা Offline অনুবাদ ব্যবহার করুন।', array('status' => 429));
		}
		set_transient($key, $count + 1, DAY_IN_SECONDS + 600);
		return true;
	}

	private static function host_variants($host) {
		$host = strtolower((string) $host);
		$bare = preg_replace('/^www\./', '', $host);
		return array($bare, 'www.' . $bare);
	}

	/**
	 * Writes must come from this site's own pages. Browsers always send Origin
	 * on cross-site POST/PUT/DELETE, so a foreign Origin is rejected.
	 */
	public static function same_site(WP_REST_Request $request) {
		$origin = $request->get_header('origin');
		if (!$origin) {
			$referer = $request->get_header('referer');
			if (!$referer) {
				return true; // Non-browser clients; still rate limited.
			}
			$origin = $referer;
		}
		$host    = wp_parse_url($origin, PHP_URL_HOST);
		$allowed = self::host_variants(wp_parse_url(home_url(), PHP_URL_HOST));
		if ($host && in_array(strtolower($host), $allowed, true)) {
			return true;
		}
		return new WP_Error('sms_forbidden_origin', 'অনুরোধ অনুমোদিত নয়।', array('status' => 403));
	}
}
