//go:build arm64

package ffmpeg

import (
	ff "github.com/go-ffstatic/linux-amd64"
)

var FfmpegPath = ff.FFmpegPath()
var FfprobePath = ff.FFprobePath()
