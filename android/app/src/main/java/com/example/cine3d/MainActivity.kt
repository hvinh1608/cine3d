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
              WebView(context).apply {
                webView = this
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.useWideViewPort = true
                settings.loadWithOverviewMode = true
                settings.mediaPlaybackRequiresUserGesture = false
                webViewClient = object : WebViewClient() {
                  @Deprecated("Deprecated in Java")
                  override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                    url?.let { view?.loadUrl(it) }
                    return true
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
                loadUrl("https://cine3d.vercel.app")
              }
            },
            modifier = Modifier.fillMaxSize()
          )
        }
      }
    }
  }
}
