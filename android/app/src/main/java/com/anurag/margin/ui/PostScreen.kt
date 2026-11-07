package com.anurag.margin.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.outlined.AudioFile
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.HideImage
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.PrivacyTip
import androidx.compose.material.icons.outlined.VideocamOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.anurag.margin.Linkify
import com.anurag.margin.Media
import com.anurag.margin.MediaKind
import com.anurag.margin.Post
import com.anurag.margin.Profile
import com.anurag.margin.Snapshot
import com.anurag.margin.TextPart

data class PostActions(
    val onBack: () -> Unit,
    val onCopyLink: () -> Unit,
    val onShareLink: () -> Unit,
    val onSaveJson: () -> Unit,
    val onOpenUrl: (String) -> Unit,
)

private data class Person(val name: String, val handle: String, val profile: Profile?)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostScreen(snapshot: Snapshot, shareable: Boolean, actions: PostActions) {
    val colors = Margin.colors
    var person by remember { mutableStateOf<Person?>(null) }
    var source by remember { mutableStateOf<String?>(null) }

    Scaffold(
        containerColor = colors.background,
        topBar = {
            TopAppBar(
                title = { Wordmark() },
                navigationIcon = {
                    IconButton(onClick = actions.onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (shareable) {
                        IconButton(onClick = actions.onShareLink) {
                            Icon(Icons.Outlined.Share, contentDescription = "Share reader link")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = colors.background,
                    scrolledContainerColor = colors.background,
                    navigationIconContentColor = colors.foreground,
                    actionIconContentColor = colors.foreground,
                ),
            )
        },
    ) { padding ->
        Column(
            Modifier
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
                .padding(top = 8.dp, bottom = 32.dp)
                .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            if (snapshot.example) {
                Text(
                    "Example. Invented to show this page. Not a real post and not from X.",
                    color = colors.accentFg,
                    style = TextStyle(fontFamily = Sans, fontSize = 13.sp),
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .background(colors.accent)
                        .padding(horizontal = 14.dp, vertical = 7.dp),
                )
            }
            PostCard(
                post = snapshot.post,
                shareable = shareable,
                actions = actions,
                onPerson = { person = it },
                onSource = { source = it },
            )
        }
    }

    person?.let { shown ->
        ModalBottomSheet(
            onDismissRequest = { person = null },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            containerColor = colors.card,
            scrimColor = colors.foreground.copy(alpha = 0.4f),
        ) {
            ProfileContent(shown, actions.onOpenUrl)
        }
    }

    source?.let { url ->
        AlertDialog(
            onDismissRequest = { source = null },
            containerColor = colors.card,
            icon = { Icon(Icons.Outlined.PrivacyTip, contentDescription = null, tint = colors.primary) },
            title = { Text("This opens X", fontFamily = Serif, fontSize = 22.sp) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        "You blocked X so it would not load. Opening this address asks the browser to visit x.com " +
                            "or twitter.com anyway. Margin does not open it for you.",
                        color = colors.mutedFg,
                    )
                    Text(
                        url,
                        style = TextStyle(fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace, fontSize = 12.sp),
                        color = colors.mutedFg,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(colors.muted)
                            .padding(10.dp),
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = { source = null }) { Text("Stay here", color = colors.primary) }
            },
            dismissButton = {
                TextButton(onClick = {
                    source = null
                    actions.onOpenUrl(url)
                }) { Text("Open anyway", color = colors.mutedFg) }
            },
        )
    }
}

@Composable
private fun PostCard(
    post: Post,
    shareable: Boolean,
    actions: PostActions,
    onPerson: (Person) -> Unit,
    onSource: (String) -> Unit,
) {
    val colors = Margin.colors
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(colors.card)
            .border(1.dp, colors.border, RoundedCornerShape(20.dp)),
    ) {
        Column(Modifier.padding(start = 20.dp, end = 20.dp, top = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier
                    .bleed(8.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .clickable(onClickLabel = "View profile", role = Role.Button) {
                        onPerson(Person(post.authorName, post.authorHandle, post.profile))
                    }
                    .padding(horizontal = 8.dp, vertical = 6.dp),
            ) {
                Avatar(post.authorName, post.authorHandle, post.profile?.avatar, 46.dp)
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            post.authorName,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 17.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f, fill = false),
                        )
                        if (post.profile?.verified == true) VerifiedBadge()
                    }
                    Text(
                        "@${post.authorHandle} ·\u00A0${formatPostTime(post.createdAt).replace(' ', '\u00A0')}",
                        color = colors.mutedFg,
                        fontSize = 14.sp,
                    )
                }
                Icon(Icons.Outlined.ChevronRight, contentDescription = null, tint = colors.mutedFg.copy(alpha = 0.7f))
            }

            LinkedText(
                post.text.ifEmpty { "No text was included in this snapshot." },
                style = TextStyle(
                    fontFamily = Serif,
                    fontSize = 20.sp,
                    lineHeight = 32.sp,
                    color = if (post.text.isEmpty()) colors.mutedFg else colors.foreground,
                ),
            )

            MediaNotes(post.media)

            post.quote?.let { quote ->
                QuoteCard(quote, onPerson, onSource)
            }
        }

        Spacer(Modifier.height(20.dp))
        HorizontalDivider(color = colors.border)
        Row(
            Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (shareable) ToolButton(Icons.Outlined.ContentCopy, "Copy link", actions.onCopyLink)
            ToolButton(Icons.Outlined.Download, "JSON", actions.onSaveJson)
            post.sourceUrl?.let { url ->
                ToolButton(Icons.AutoMirrored.Outlined.OpenInNew, "Source") { onSource(url) }
            }
        }
    }
}

private fun Modifier.bleed(amount: Dp) = layout { measurable, constraints ->
    val extra = amount.roundToPx() * 2
    val placeable = measurable.measure(
        constraints.copy(
            minWidth = constraints.minWidth + extra,
            maxWidth = if (constraints.hasBoundedWidth) constraints.maxWidth + extra else constraints.maxWidth,
        ),
    )
    layout(placeable.width - extra, placeable.height) { placeable.place(-extra / 2, 0) }
}

@Composable
private fun ToolButton(icon: ImageVector, label: String, onClick: () -> Unit) {
    val colors = Margin.colors
    TextButton(onClick = onClick, contentPadding = PaddingValues(horizontal = 12.dp)) {
        Icon(icon, contentDescription = null, tint = colors.mutedFg, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(8.dp))
        Text(label, color = colors.mutedFg, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun QuoteCard(quote: Post, onPerson: (Person) -> Unit, onSource: (String) -> Unit) {
    val colors = Margin.colors
    val line = colors.paperLine
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(colors.background.copy(alpha = 0.5f))
            .border(BorderStroke(1.dp, colors.border), RoundedCornerShape(14.dp))
            .drawBehind { drawRect(line, Offset.Zero, size.copy(width = 2.dp.toPx())) }
            .padding(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier
                .bleed(6.dp)
                .clip(RoundedCornerShape(10.dp))
                .clickable(onClickLabel = "View profile", role = Role.Button) {
                    onPerson(Person(quote.authorName, quote.authorHandle, quote.profile))
                }
                .padding(horizontal = 6.dp, vertical = 4.dp),
        ) {
            Avatar(quote.authorName, quote.authorHandle, quote.profile?.avatar, 26.dp)
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(quote.authorName, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (quote.profile?.verified == true) VerifiedBadge(14.dp)
                }
                Text(
                    "@${quote.authorHandle}" + (quote.createdAt?.let { " ·\u00A0${formatPostTime(it, dateOnly = true).replace(' ', '\u00A0')}" } ?: ""),
                    color = colors.mutedFg,
                    fontSize = 13.sp,
                )
            }
        }
        LinkedText(quote.text, TextStyle(fontFamily = Serif, fontSize = 17.sp, lineHeight = 26.sp, color = colors.foreground))
        MediaNotes(quote.media)
        quote.sourceUrl?.let { url ->
            TextButton(onClick = { onSource(url) }, contentPadding = PaddingValues(0.dp)) {
                Icon(Icons.AutoMirrored.Outlined.OpenInNew, contentDescription = null, tint = colors.mutedFg, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Quoted source on X", color = colors.mutedFg)
            }
        }
    }
}

@Composable
private fun MediaNotes(media: List<Media>) {
    if (media.isEmpty()) return
    val colors = Margin.colors
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        media.forEach { item ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(colors.muted)
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                val icon = when (item.kind) {
                    MediaKind.PHOTO -> Icons.Outlined.HideImage
                    MediaKind.AUDIO -> Icons.Outlined.AudioFile
                    else -> Icons.Outlined.VideocamOff
                }
                Icon(icon, contentDescription = null, tint = colors.mutedFg, modifier = Modifier.size(18.dp).padding(top = 2.dp))
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        "${item.kind.label} unavailable · not loaded from X",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                    )
                    item.alt?.let { Text(it, color = colors.mutedFg, fontSize = 14.sp, lineHeight = 20.sp) }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ProfileContent(person: Person, onOpenUrl: (String) -> Unit) {
    val colors = Margin.colors
    val profile = person.profile
    Column(
        Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp)
            .padding(bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Avatar(person.name, person.handle, profile?.avatar, 68.dp)
            Column {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(person.name, fontWeight = FontWeight.SemiBold, fontSize = 20.sp, modifier = Modifier.weight(1f, fill = false))
                    if (profile?.verified == true) VerifiedBadge(18.dp)
                }
                Text("@${person.handle}", color = colors.mutedFg, fontSize = 15.sp)
            }
        }

        profile?.bio?.let { LinkedText(it, TextStyle(fontFamily = Sans, fontSize = 16.sp, lineHeight = 24.sp, color = colors.foreground)) }

        if (profile?.location != null || profile?.website != null || profile?.joinedAt != null) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                profile.location?.let { Fact(Icons.Outlined.Place, it) }
                profile.website?.let { site ->
                    val part = Linkify.classify(site)
                    val shown = site.removePrefix("https://").removePrefix("www.").trimEnd('/')
                    if (part is TextPart.Link) {
                        Fact(Icons.Outlined.Link, shown, link = true) { onOpenUrl(part.href) }
                    } else {
                        Fact(Icons.Outlined.Link, site)
                    }
                }
                profile.joinedAt?.let { Fact(Icons.Outlined.CalendarMonth, "Joined ${formatJoined(it)}") }
            }
        }

        val stats = listOfNotNull(
            profile?.following?.let { it to "following" },
            profile?.followers?.let { it to "followers" },
            profile?.posts?.let { it to "posts" },
        )
        if (stats.isNotEmpty()) {
            Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                stats.forEach { (value, label) ->
                    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(formatCount(value), fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                        Text(label, color = colors.mutedFg, fontSize = 15.sp)
                    }
                }
            }
        }

        HorizontalDivider(color = colors.border)
        Text(
            if (profile != null) "As captured in this snapshot. Margin does not look profiles up on X."
            else "No profile was included in this snapshot. Margin does not look profiles up on X.",
            color = colors.mutedFg,
            fontSize = 13.sp,
            lineHeight = 18.sp,
        )
    }
}

@Composable
private fun Fact(icon: ImageVector, text: String, link: Boolean = false, onClick: (() -> Unit)? = null) {
    val colors = Margin.colors
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        modifier = if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier,
    ) {
        Icon(icon, contentDescription = null, tint = colors.mutedFg, modifier = Modifier.size(16.dp))
        Text(
            text,
            color = if (link) colors.foreground else colors.mutedFg,
            fontSize = 15.sp,
            textDecoration = if (link) androidx.compose.ui.text.style.TextDecoration.Underline else null,
        )
    }
}
