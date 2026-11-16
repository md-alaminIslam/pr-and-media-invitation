<?php
/**
 * One-click updates from GitHub releases.
 *
 * Every push to main builds a release tagged wp-vX.Y.Z with savor-media-studio.zip
 * attached. WordPress then shows the update in Dashboard → Updates and Plugins,
 * like any other plugin (and can auto-update it if you enable that).
 */

if (!defined('ABSPATH')) {
	exit;
}

class SMS_Updater {
	const CACHE = 'sms_latest_release';

	public static function init() {
		add_filter('pre_set_site_transient_update_plugins', array(__CLASS__, 'check'));
		add_filter('plugins_api', array(__CLASS__, 'info'), 20, 3);
		add_action('upgrader_process_complete', function () {
			delete_site_transient(self::CACHE);
		});
	}

	private static function latest() {
		$cached = get_site_transient(self::CACHE);
		if (is_array($cached)) {
			return $cached;
		}
		$res = wp_remote_get('https://api.github.com/repos/' . SMS_REPO . '/releases?per_page=10', array(
			'timeout' => 10,
			'headers' => array('Accept' => 'application/vnd.github+json', 'User-Agent' => 'savor-media-studio'),
		));
		$latest = array();
		if (!is_wp_error($res) && 200 === wp_remote_retrieve_response_code($res)) {
			foreach ((array) json_decode(wp_remote_retrieve_body($res), true) as $release) {
				if (!empty($release['draft']) || !preg_match('/^wp-v(\d+\.\d+\.\d+)$/', (string) ($release['tag_name'] ?? ''), $m)) {
					continue;
				}
				foreach ((array) ($release['assets'] ?? array()) as $asset) {
					if ('savor-media-studio.zip' === ($asset['name'] ?? '')) {
						if (!$latest || version_compare($m[1], $latest['version'], '>')) {
							$latest = array(
								'version' => $m[1],
								'package' => $asset['browser_download_url'],
								'url'     => $release['html_url'],
								'notes'   => (string) ($release['body'] ?? ''),
								'date'    => (string) ($release['published_at'] ?? ''),
							);
						}
					}
				}
			}
		}
		set_site_transient(self::CACHE, $latest, $latest ? 6 * HOUR_IN_SECONDS : HOUR_IN_SECONDS);
		return $latest;
	}

	public static function check($transient) {
		if (!is_object($transient) || empty($transient->checked)) {
			return $transient;
		}
		$latest = self::latest();
		$file   = plugin_basename(SMS_FILE);
		$item   = (object) array(
			'slug'        => 'savor-media-studio',
			'plugin'      => $file,
			'new_version' => $latest ? $latest['version'] : SMS_VERSION,
			'url'         => 'https://github.com/' . SMS_REPO,
			'package'     => $latest ? $latest['package'] : '',
		);
		if ($latest && version_compare($latest['version'], SMS_VERSION, '>')) {
			$transient->response[$file] = $item;
		} else {
			$transient->no_update[$file] = $item;
		}
		return $transient;
	}

	public static function info($result, $action, $args) {
		if ('plugin_information' !== $action || 'savor-media-studio' !== ($args->slug ?? '')) {
			return $result;
		}
		$latest = self::latest();
		return (object) array(
			'name'          => 'SAVOR Media Studio',
			'slug'          => 'savor-media-studio',
			'version'       => $latest ? $latest['version'] : SMS_VERSION,
			'author'        => 'Savor International Limited',
			'homepage'      => 'https://github.com/' . SMS_REPO,
			'download_link' => $latest ? $latest['package'] : '',
			'last_updated'  => $latest ? $latest['date'] : '',
			'sections'      => array(
				'description' => 'Bangla & English media invitation and press release studio with an autosaving file manager.',
				'changelog'   => $latest ? nl2br(esc_html($latest['notes'])) : '',
			),
		);
	}
}
