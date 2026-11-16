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
		$out  = array(
			'slug'            => '' === $slug ? 'media-studio' : $slug,
			'gemini_passcode' => isset($input['gemini_passcode']) ? trim(sanitize_text_field(wp_unslash($input['gemini_passcode']))) : '',
			'ai_provider'     => isset($input['ai_provider']) && isset(SMS_Translate::PROVIDERS[$input['ai_provider']]) ? $input['ai_provider'] : 'gemini',
		);
		foreach (array_keys(SMS_Translate::PROVIDERS) as $p) {
			$key = isset($input[$p . '_key']) ? trim(sanitize_text_field(wp_unslash($input[$p . '_key']))) : '';
			if (!empty($input[$p . '_key_clear'])) {
				$key = '';
			} elseif ('' === $key) {
				$key = (string) ($old[$p . '_key'] ?? ''); // Blank field keeps the saved key.
			}
			$out[$p . '_key']   = $key;
			$out[$p . '_model'] = isset($input[$p . '_model']) ? preg_replace('/[^a-z0-9.\-_:]/i', '', wp_unslash($input[$p . '_model'])) : '';
		}
		return $out;
	}

	public static function page() {
		if (!current_user_can('manage_options')) {
			return;
		}
		$s          = sms_settings();
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
						<th scope="row"><label for="sms-provider">Translation AI</label></th>
						<td>
							<select id="sms-provider" name="sms_settings[ai_provider]">
								<?php foreach (SMS_Translate::PROVIDERS as $id => $info) : ?>
									<option value="<?php echo esc_attr($id); ?>" <?php selected($s['ai_provider'], $id); ?>><?php echo esc_html($info['label']); ?><?php echo SMS_Translate::key($id) ? '' : ' (no key yet)'; ?></option>
								<?php endforeach; ?>
							</select>
							<p class="description">Default AI for translation. Every provider with a key can also be picked inside the studio. Without any key, the studio uses Offline translation only. Keys never reach the browser.</p>
						</td>
					</tr>
					<?php foreach (array('gemini' => array('Google Gemini', 'aistudio.google.com', 'SMS_GEMINI_API_KEY'), 'anthropic' => array('Anthropic Claude', 'console.anthropic.com', 'SMS_ANTHROPIC_API_KEY'), 'openai' => array('OpenAI ChatGPT', 'platform.openai.com', 'SMS_OPENAI_API_KEY')) as $pid => $info) : ?>
					<tr>
						<th scope="row"><label for="sms-<?php echo esc_attr($pid); ?>-key"><?php echo esc_html($info[0]); ?></label></th>
						<td>
							<?php if (defined($info[2]) && constant($info[2])) : ?>
								<p><strong>Key set in wp-config.php</strong> (<code><?php echo esc_html($info[2]); ?></code>).</p>
							<?php else : ?>
								<input id="sms-<?php echo esc_attr($pid); ?>-key" type="password" name="sms_settings[<?php echo esc_attr($pid); ?>_key]" value="" class="regular-text" autocomplete="off" placeholder="<?php echo !empty($s[$pid . '_key']) ? esc_attr('•••••••• saved — leave blank to keep') : esc_attr('API key from ' . $info[1]); ?>">
								<?php if (!empty($s[$pid . '_key'])) : ?>
									<label style="margin-left:8px"><input type="checkbox" name="sms_settings[<?php echo esc_attr($pid); ?>_key_clear]" value="1"> Remove</label>
								<?php endif; ?>
							<?php endif; ?>
							<p style="margin-top:6px"><input name="sms_settings[<?php echo esc_attr($pid); ?>_model]" value="<?php echo esc_attr($s[$pid . '_model'] ?? ''); ?>" class="regular-text" placeholder="Model — automatic (<?php echo esc_attr(SMS_Translate::model($pid)); ?>)"></p>
						</td>
					</tr>
					<?php endforeach; ?>
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
