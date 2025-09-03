package com.example.quantummint

import android.os.Bundle
import androidx.activity.ComponentActivity
import android.content.Intent
import android.net.Uri
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.view.KeyEvent
import android.view.Menu
import android.view.MenuItem
import android.app.AlertDialog
import android.widget.EditText

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        webView = findViewById(R.id.webView)

        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                return false
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback = filePathCallback
                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                }
                startActivityForResult(intent, 1001)
                return true
            }
        }

        val prefs = getSharedPreferences("quantummint", MODE_PRIVATE)
        val baseUrl = prefs.getString("base_url", null) ?: "http://10.0.2.2:3006"
        val data = intent?.data
        if (data != null) {
            // Deep link: pass to web app as path with params
            val url = "$baseUrl/callback?uri=${data.toString()}"
            webView.loadUrl(url)
        } else {
            webView.loadUrl(baseUrl)
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && this::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 1001) {
            val result = if (data == null || resultCode != RESULT_OK) null else data.data?.let { arrayOf(it) }
            filePathCallback?.onReceiveValue(result)
            filePathCallback = null
        }
    }

    override fun onCreateOptionsMenu(menu: Menu?): Boolean {
        menuInflater.inflate(R.menu.main_menu, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.action_env -> {
                showEnvDialog()
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }

    private fun showEnvDialog() {
        val view = layoutInflater.inflate(R.layout.dialog_env_selector, null)
        val urlDev = view.findViewById<EditText>(R.id.urlDev)
        val urlStaging = view.findViewById<EditText>(R.id.urlStaging)
        val urlProd = view.findViewById<EditText>(R.id.urlProd)
        val prefs = getSharedPreferences("quantummint", MODE_PRIVATE)
        val current = prefs.getString("base_url", "http://10.0.2.2:3006")
        urlDev.setText(current)

        AlertDialog.Builder(this)
            .setTitle("Select Environment")
            .setView(view)
            .setPositiveButton("Use Dev") { _, _ -> saveAndReload(urlDev.text.toString()) }
            .setNeutralButton("Use Staging") { _, _ -> saveAndReload(urlStaging.text.toString()) }
            .setNegativeButton("Use Prod") { _, _ -> saveAndReload(urlProd.text.toString()) }
            .show()
    }

    private fun saveAndReload(url: String) {
        val prefs = getSharedPreferences("quantummint", MODE_PRIVATE)
        prefs.edit().putString("base_url", url).apply()
        webView.loadUrl(url)
    }
}