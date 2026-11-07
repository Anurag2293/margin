package com.anurag.margin.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.ContentPaste
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.FileOpen
import androidx.compose.material.icons.outlined.LinkOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.anurag.margin.HistoryEntry
import com.anurag.margin.Opened
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

data class HomeActions(
    val onPaste: () -> Unit,
    val onOpenFile: () -> Unit,
    val onExample: () -> Unit,
    val onOpenEntry: (HistoryEntry) -> Unit,
    val onRemoveEntry: (HistoryEntry) -> Unit,
)

@Composable
fun HomeScreen(
    history: List<HistoryEntry>,
    problem: Opened?,
    snackbar: SnackbarHostState,
    actions: HomeActions,
) {
    val colors = Margin.colors
    Scaffold(
        containerColor = colors.background,
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                start = 20.dp,
                end = 20.dp,
                top = padding.calculateTopPadding() + 12.dp,
                bottom = padding.calculateBottomPadding() + 32.dp,
            ),
        ) {
            item { Wordmark() }
            item { Hero() }
            item { Actions(actions) }
            if (problem != null) item { Problem(problem) }
            item {
                Text(
                    "RECENT",
                    color = colors.mutedFg,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 1.5.sp,
                    modifier = Modifier.padding(top = 36.dp, bottom = 8.dp),
                )
            }
            if (history.isEmpty()) {
                item {
                    Text(
                        "Posts you open show up here. Tap a Margin reader link in any app, or share one to Margin.",
                        color = colors.mutedFg,
                        fontSize = 14.sp,
                        lineHeight = 20.sp,
                    )
                }
            }
            items(history, key = { it.key }) { entry ->
                RecentRow(entry, actions)
            }
        }
    }
}

@Composable
private fun Hero() {
    val colors = Margin.colors
    Column(Modifier.padding(top = 36.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.size(width = 2.dp, height = 14.dp).background(colors.primary, RoundedCornerShape(1.dp)))
            Text(
                "ONE POST. NO TIMELINE.",
                color = colors.primary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                letterSpacing = 1.7.sp,
            )
        }
        Text(
            "Read one post, and nothing else.",
            fontFamily = Serif,
            fontWeight = FontWeight.Medium,
            fontSize = 38.sp,
            lineHeight = 41.sp,
            color = colors.foreground,
        )
        Text(
            "Open a snapshot someone handed you. Margin shows that post on a quiet page, with no feed, no account, " +
                "and nothing loaded from X.",
            color = colors.mutedFg,
            fontSize = 16.sp,
            lineHeight = 24.sp,
        )
    }
}

@Composable
private fun Actions(actions: HomeActions) {
    val colors = Margin.colors
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Button(
            onClick = actions.onPaste,
            modifier = Modifier.fillMaxWidth().height(54.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = colors.primary, contentColor = colors.primaryFg),
        ) {
            Icon(Icons.Outlined.ContentPaste, contentDescription = null, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(10.dp))
            Text("Paste link or JSON", fontSize = 16.sp, fontWeight = FontWeight.Medium)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(
                onClick = actions.onOpenFile,
                modifier = Modifier.weight(1f).height(48.dp),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, colors.border),
            ) {
                Icon(Icons.Outlined.FileOpen, contentDescription = null, tint = colors.foreground, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Open file", color = colors.foreground)
            }
            OutlinedButton(
                onClick = actions.onExample,
                modifier = Modifier.weight(1f).height(48.dp),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, colors.border),
            ) {
                Icon(Icons.Outlined.AutoAwesome, contentDescription = null, tint = colors.foreground, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Example", color = colors.foreground)
            }
        }
    }
}

@Composable
private fun Problem(problem: Opened) {
    val colors = Margin.colors
    Column(
        Modifier
            .padding(top = 16.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(if (problem is Opened.UrlOnly) colors.accent else colors.muted)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        when (problem) {
            is Opened.UrlOnly -> {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Outlined.LinkOff, contentDescription = null, tint = colors.accentFg, modifier = Modifier.size(20.dp))
                    Text("A link is not the post", fontFamily = Serif, fontSize = 22.sp, color = colors.accentFg)
                }
                Text(
                    if (problem.x) "Margin never contacts X, so this address has no text, name, or time to show."
                    else "Margin does not fetch web addresses. This one has no post inside it.",
                    color = colors.foreground,
                    fontSize = 15.sp,
                    lineHeight = 22.sp,
                )
                Text(problem.url, color = colors.mutedFg, fontSize = 13.sp, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace)
            }
            is Opened.Invalid -> Text(problem.error, color = colors.destructive, fontSize = 15.sp, lineHeight = 22.sp)
            is Opened.Post -> Unit
        }
    }
}

@Composable
private fun RecentRow(entry: HistoryEntry, actions: HomeActions) {
    val colors = Margin.colors
    val state = rememberSwipeToDismissBoxState(
        confirmValueChange = {
            if (it != SwipeToDismissBoxValue.Settled) actions.onRemoveEntry(entry)
            it != SwipeToDismissBoxValue.Settled
        },
    )
    SwipeToDismissBox(
        state = state,
        backgroundContent = {
            Box(
                Modifier.fillMaxSize().clip(RoundedCornerShape(16.dp)).background(colors.muted).padding(horizontal = 20.dp),
                contentAlignment = Alignment.CenterEnd,
            ) {
                Icon(Icons.Outlined.DeleteOutline, contentDescription = null, tint = colors.mutedFg)
            }
        },
        modifier = Modifier.padding(vertical = 4.dp),
    ) {
        val post = entry.snapshot.post
        Row(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(colors.card)
                .border(1.dp, colors.border, RoundedCornerShape(16.dp))
                .clickable { actions.onOpenEntry(entry) }
                .padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Avatar(post.authorName, post.authorHandle, post.profile?.avatar, 40.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            post.authorName,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f, fill = false),
                        )
                        if (post.profile?.verified == true) {
                            Spacer(Modifier.width(4.dp))
                            VerifiedBadge(14.dp)
                        }
                    }
                    Spacer(Modifier.width(8.dp))
                    Text(opened(entry.openedAt), color = colors.mutedFg, fontSize = 12.sp)
                }
                Text(
                    post.text.ifEmpty { "Media only" },
                    fontFamily = Serif,
                    fontSize = 16.sp,
                    lineHeight = 22.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    color = colors.foreground,
                )
            }
        }
    }
}

private val sameYear = DateTimeFormatter.ofPattern("MMM d", Locale.US)
private val otherYear = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US)
private val clock = DateTimeFormatter.ofPattern("h:mm a", Locale.US)

private fun opened(millis: Long): String {
    val zone = ZoneId.systemDefault()
    val time = Instant.ofEpochMilli(millis).atZone(zone)
    val today = java.time.LocalDate.now(zone)
    val days = ChronoUnit.DAYS.between(time.toLocalDate(), today)
    return when {
        days == 0L -> clock.format(time)
        days == 1L -> "Yesterday"
        time.year == today.year -> sameYear.format(time)
        else -> otherYear.format(time)
    }
}
