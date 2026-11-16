<?php
/**
 * Settings → Media Studio (administrators only).
 */

if (!defined('ABSPATH')) {
	exit;
}

class SMS_Admin {
	public static function init() {
		add_action('admin_menu', array(__CLASS__, 'menu'));
		add_action('admin_init', array(__CLASS__, 'register'));
		add_filter('plugin_action_links_' . plugin_basename(SMS_FILE), array(__CLASS__, 'links'));
	}

	public static function links($links) {
		array_unshift(
			$links,
			'<a href="' . esc_url(admin_url('options-general.php?page=savor-media-studio')) . '">Settings</a>',
			'<a href="' . esc_url(SMS_Frontend::url()) . '" target="_blank" rel="noopener">Open studio</a>'
		);
		return $links;
	}

	public static function menu() {
		add_options_page('SAVOR Media Studio', 'Media Studio', 'manage_options', 'savor-media-studio', array(__CLASS__, 'page'));
	}

	public static function register() {
		register_setting('sms_settings_group', 'sms_settings', array(
			'type'              => 'array',
			'sanitize_callback' => array(__CLASS__, 'sanitize'),
			'default'           => array(),
		));
	}

	public static function sanitize($input) {
		$old  = sms_settings();
		$slug = isset($input['slug']) ? trim(sanitize_title_with_dashes(wp_unslash($input['slug'])), '/') : $old['slug'];
		$key  = isset($input['gemini_key']) ? trim(sanitize_text_field(wp_unslash($input['gemini_key']))) : '';
		if (!empty($input['gemini_key_clear'])) {
			$key = '';
		} elseif ('' === $key) {
			$key = $old['gemini_key']; // Blank field keeps the saved key.
		}
		return array(
			'slug'             => '' === $slug ? 'media-studio' : $slug,
			'gemini_key'       => $key,
			'gemini_model'     => isset($input['gemini_model']) ? preg_replace('/[^a-z0-9.\-]/i', '', wp_unslash($input['gemini_model'])) : '',
			'gemini_passcode'  => isset($input['gemini_passcode']) ? trim(sanitize_text_field(wp_unslash($input['gemini_passcode']))) : '',
		);
	}

	public static function page() {
		if (!current_user_can('manage_options')) {
			return;
		}
		$s          = sms_settings();
		$from_const = defined('SMS_GEMINI_API_KEY') && SMS_GEMINI_API_KEY;
		$items      = SMS_Storage::instance()->list_tree();
		$files      = count(array_filter($items, function ($i) {
			return 'file' === $i['type'];
		}));
		?>
		<div class="wrap">
			<h1>SAVOR Media Studio</h1>
			<p>
				Studio address: <a href="<?php echo esc_url(SMS_Frontend::url()); ?>" target="_blank" rel="noopener"><strong><?php echo esc_html(SMS_Frontend::url()); ?></strong></a>
				&nbsp;·&nbsp; Version <?php echo esc_html(SMS_VERSION); ?> &nbsp;·&nbsp; <?php echo (int) $files; ?> documents
			</p>
			<p class="description">
				The studio is public to anyone who knows this address (no login) and is hidden from search engines.
				It is not linked from your website. Each project is a folder of HTML documents in <code>wp-content/uploads/savor-media-studio/</code>,
				which is blocked from direct download. Deleted files are kept in its <code>trash</code> folder for 30 days,
				and each file keeps its last 30 automatic versions.
			</p>
			<form method="post" action="options.php">
				<?php settings_fields('sms_settings_group'); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="sms-slug">Studio address</label></th>
						<td>
							<code><?php echo esc_html(home_url('/')); ?></code><input id="sms-slug" name="sms_settings[slug]" value="<?php echo esc_attr($s['slug']); ?>" class="regular-text" style="width:16em">
							<p class="description">Change this to move the studio to a different, harder-to-guess address.</p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="sms-key">Gemini API key</label></th>
						<td>
							<?php if ($from_const) : ?>
								<p><strong>Set in wp-config.php</strong> (<code>SMS_GEMINI_API_KEY</code>).</p>
							<?php else : ?>
								<input id="sms-key" type="password" name="sms_settings[gemini_key]" value="" class="regular-text" autocomplete="off" placeholder="<?php echo $s['gemini_key'] ? esc_attr('•••••••• saved — leave blank to keep') : 'Paste key from Google AI Studio'; ?>">
								<?php if ($s['gemini_key']) : ?>
									<label style="margin-left:8px"><input type="checkbox" name="sms_settings[gemini_key_clear]" value="1"> Remove saved key</label>
								<?php endif; ?>
							<?php endif; ?>
							<p class="description">Without a key, the studio uses Offline translation only. The key never reaches the browser.</p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="sms-model">Gemini model</label></th>
						<td>
							<input id="sms-model" name="sms_settings[gemini_model]" value="<?php echo esc_attr($s['gemini_model']); ?>" class="regular-text" placeholder="automatic (gemini-2.5-flash or newer)">
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="sms-pass">Gemini passcode</label></th>
						<td>
							<input id="sms-pass" name="sms_settings[gemini_passcode]" value="<?php echo esc_attr($s['gemini_passcode']); ?>" class="regular-text" autocomplete="off">
							<p class="description">Optional. There is no usage cap, and anyone with the studio address can use Gemini on your API bill.
							If set, the studio asks for this passcode once before Gemini translation. Offline translation never needs it.</p>
						</td>
					</tr>
				</table>
				<?php submit_button(); ?>
			</form>
		</div>
		<?php
	}
}
