package com.anurag.margin

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import com.anurag.margin.ui.HomeActions
import com.anurag.margin.ui.HomeScreen
import com.anurag.margin.ui.MarginTheme
import com.anurag.margin.ui.PostActions
import com.anurag.margin.ui.PostScreen
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private lateinit var history: History
    private var entries by mutableStateOf<List<HistoryEntry>>(emptyList())
    private var current by mutableStateOf<Snapshot?>(null)
    private var problem by mutableStateOf<Opened?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        history = History(this)
        entries = history.load()
        savedInstanceState?.getString(STATE_POST)?.let { json ->
            (SnapshotParser.parse(json) as? ParseResult.Ok)?.let { current = it.snapshot }
        }
        if (savedInstanceState == null) handle(intent)

        setContent {
            MarginTheme {
                val snackbar = remember { SnackbarHostState() }
                val scope = rememberCoroutineScope()
                val openFile = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
                    uri?.let(::openUri)
                }
                val saveJson = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
                    val snapshot = current
                    if (uri != null && snapshot != null) {
                        contentResolver.openOutputStream(uri)?.use { it.write(SnapshotJson.pretty(snapshot).toByteArray()) }
                        toast("Saved")
                    }
                }

                val shown = current
                if (shown != null) {
                    BackHandler { current = null }
                    val link = remember(shown) { Share.link(shown) }
                    PostScreen(
                        snapshot = shown,
                        shareable = link != null,
                        actions = PostActions(
                            onBack = { current = null },
                            onCopyLink = {
                                link?.let {
                                    clipboard().setPrimaryClip(ClipData.newPlainText("Margin reader link", it))
                                }
                            },
                            onShareLink = { link?.let(::shareText) },
                            onSaveJson = { saveJson.launch("margin-${shown.post.authorHandle}.json") },
                            onOpenUrl = ::openUrl,
                        ),
                    )
                } else {
                    HomeScreen(
                        history = entries,
                        problem = problem,
                        snackbar = snackbar,
                        actions = HomeActions(
                            onPaste = {
                                val text = clipboard().primaryClip?.takeIf { it.itemCount > 0 }
                                    ?.getItemAt(0)?.coerceToText(this)?.toString()
                                if (text.isNullOrBlank()) problem = Opened.Invalid("The clipboard is empty.")
                                else open(text)
                            },
                            onOpenFile = { openFile.launch(arrayOf("application/json", "text/*", "application/octet-stream")) },
                            onExample = { show(Example.snapshot) },
                            onOpenEntry = { show(it.snapshot) },
                            onRemoveEntry = { entry ->
                                entries = history.remove(entry.key)
                                scope.launch {
                                    snackbar.currentSnackbarData?.dismiss()
                                    val result = snackbar.showSnackbar("Removed", "Undo", duration = SnackbarDuration.Short)
                                    if (result == SnackbarResult.ActionPerformed) entries = history.restore(entry)
                                }
                            },
                        ),
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        current?.let { outState.putString(STATE_POST, SnapshotJson.canonical(it)) }
    }

    private fun handle(intent: Intent?) {
        when (intent?.action) {
            Intent.ACTION_VIEW -> intent.data?.let { uri ->
                if (uri.scheme == "content" || uri.scheme == "file") openUri(uri) else open(uri.toString())
            }
            Intent.ACTION_SEND -> {
                val stream = intent.streamUri()
                val text = intent.getStringExtra(Intent.EXTRA_TEXT)
                when {
                    text != null -> open(text)
                    stream != null -> openUri(stream)
                }
            }
        }
    }

    private fun open(input: String) {
        when (val result = Importer.open(input)) {
            is Opened.Post -> show(result.snapshot)
            else -> {
                current = null
                problem = result
            }
        }
    }

    private fun show(snapshot: Snapshot) {
        problem = null
        current = snapshot
        entries = history.record(snapshot)
    }

    private fun openUri(uri: Uri) {
        val bytes = try {
            contentResolver.openInputStream(uri)?.use { stream ->
                val out = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                while (out.size() <= Limits.MAX_BYTES) {
                    val count = stream.read(buffer)
                    if (count < 0) break
                    out.write(buffer, 0, count)
                }
                out.toByteArray()
            }
        } catch (_: Exception) {
            null
        }
        when {
            bytes == null -> fail("That file could not be read.")
            bytes.size > Limits.MAX_BYTES -> fail("That file is larger than 48 KB.")
            else -> open(String(bytes, Charsets.UTF_8))
        }
    }

    private fun fail(message: String) {
        current = null
        problem = Opened.Invalid(message)
    }

    private fun clipboard() = getSystemService(ClipboardManager::class.java)

    private fun shareText(text: String) {
        val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
        startActivity(Intent.createChooser(send, null))
    }

    private fun openUrl(url: String) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE))
        } catch (_: Exception) {
            toast("No app can open that link")
        }
    }

    private fun toast(text: String) = Toast.makeText(this, text, Toast.LENGTH_SHORT).show()

    @Suppress("DEPRECATION")
    private fun Intent.streamUri(): Uri? =
        if (android.os.Build.VERSION.SDK_INT >= 33) getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        else getParcelableExtra(Intent.EXTRA_STREAM)

    companion object {
        private const val STATE_POST = "post"
    }
}
