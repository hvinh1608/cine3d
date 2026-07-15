package com.example.cine3d

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.example.cine3d.theme.Cine3DTheme

class MainActivity : ComponentActivity() {
  private var uploadMessage: ValueCallback<Array<Uri>>? = null

  private val fileChooserLauncher = registerForActivityResult(
    ActivityResultContracts.StartActivityForResult()
  ) { result ->
    if (result.resultCode == Activity.RESULT_OK) {
      val data: Intent? = result.data
      val results = if (data != null) {
        val dataString = data.dataString
        val clipData = data.clipData
        if (clipData != null) {
          val uris = Array(clipData.itemCount) { i -> clipData.getItemAt(i).uri }
          uris
        } else if (dataString != null) {
          arrayOf(Uri.parse(dataString))
        } else {
          null
        }
      } else {
        null
      }
      uploadMessage?.onReceiveValue(results)
    } else {
      uploadMessage?.onReceiveValue(null)
    }
    uploadMessage = null
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    enableEdgeToEdge()
    setContent {
      Cine3DTheme {
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
          var webView: WebView? = null

          BackHandler(enabled = true) {
            if (webView?.canGoBack() == true) {
              webView?.goBack()
            } else {
              finish()
            }
          }

          AndroidView(
            factory = { context ->
              val swipeRefreshLayout = SwipeRefreshLayout(context)

              val web = WebView(context).apply {
                webView = this
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.useWideViewPort = true
                settings.loadWithOverviewMode = true
                settings.mediaPlaybackRequiresUserGesture = false
                settings.cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE

                // Clear WebView cache on app startup to prevent cached old layout states
                clearCache(true)

                webViewClient = object : WebViewClient() {
                  @Deprecated("Deprecated in Java")
                  override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                    url?.let { view?.loadUrl(it) }
                    return true
                  }

                  override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    swipeRefreshLayout.isRefreshing = false
                  }
                }
                webChromeClient = object : WebChromeClient() {
                  override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                  ): Boolean {
                    uploadMessage?.onReceiveValue(null)
                    uploadMessage = filePathCallback

                    val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                      type = "image/*"
                      addCategory(Intent.CATEGORY_OPENABLE)
                    }

                    try {
                      fileChooserLauncher.launch(intent)
                    } catch (e: Exception) {
                      uploadMessage?.onReceiveValue(null)
                      uploadMessage = null
                      return false
                    }
                    return true
                  }
                }
                loadUrl("https://cine3d.id.vn/?appVersion=1.0.2")
              }

              swipeRefreshLayout.addView(web)
              swipeRefreshLayout.setOnRefreshListener {
                web.reload()
              }

              // Trigger swipe refresh pull ONLY when scrolled to the very top
              web.viewTreeObserver.addOnScrollChangedListener {
                swipeRefreshLayout.isEnabled = web.scrollY == 0
              }

              swipeRefreshLayout
            },
            modifier = Modifier.fillMaxSize()
          )
        }
      }
    }
  }
}
