import FlussonicMsePlayer from '../FlussonicMsePlayer.js'
import {humanTime} from './utils'
import {decode} from 'querystring'
// import Chart from 'chart.js'

window.onload = onLoad()

function onLoad() {
  let streamer_ws = 'ws://localhost:8080'
  let stream_name = 'clock'

  // parse query string
  let query = window.location.search
  if (query) {
    let qs = decode(query.replace(/^\?/, ''))
    if (qs.host) {
      streamer_ws = qs.host
    }
    if (qs.name) {
      stream_name = qs.name
    }
  }
  let url = streamer_ws + '/' + stream_name + '/mse_ld'

  const element = document.getElementById('player')
  const videoTracksSelect = document.getElementById('videoTracks')
  const audioTracksSelect = document.getElementById('audioTracks')
  const mbrControls = document.querySelector('.mbr-controls')
  const utcLabel = document.getElementById('utc')
  const stallingLabel = document.getElementById('stallingLabel')
  const showStallingIndicator = (value) => {
    stallingLabel.innerText = '' + value
  }

  let showFirstFrameUTC = false

  let timeLineChart = []
  let graphUTCLabels = []
  // let graphCurrentTime = []
  // let graphBufferedTime = []
  let graphBufferedLength = []
  let mseVideoBufferSize = []
  let mseAudioBufferSize = []

  const messagesUTC = []
  const messagesTimelag = []

  const opts = {
    debug: true,
    connectionRetries: 0,
    errorsBeforeStop: 10,
    retryMuted: true,
    maxBufferDelay: 0,
    onStartStalling: () => {
      showStallingIndicator('start stalling')
    },
    onEndStalling: () => {
      showStallingIndicator('stop stalling')
    },
    onSeeked: () => {
      showFirstFrameUTC = true
    },
    onProgress: (utc) => {
      utcLabel.innerText = humanTime(utc)
      if (showFirstFrameUTC) {
        console.log('%c first frame after action: ' + humanTime(utc) + ' ' + utc, 'background: red')
        showFirstFrameUTC = false
      }
      timeLineChart.push({
        x: new Date(),
        // y: 0,
      })
      if (timeLineChart.length === 100) {
        timeLineChart.shift()
      }
      eventsChart.update()
    },
    onDisconnect: (status) => {
      console.log('Websocket status:', status)
    },
    onMediaInfo: (rawMetaData) => {
      console.log('rawMetaData:', rawMetaData)
      const videoTracks = window.player.getVideoTracks()
      const audioTracks = window.player.getAudioTracks()
      const videoOptions = videoTracks.map(
        (v, i) =>
          `<option value="${v['track_id']}">${v['bitrate']} ${v['codec']} ${v['fps']} ${v['width']}x${v['height']}</option>`
      )

      const audioOptions = audioTracks.map(
        (v) => `<option value="${v['track_id']}">${v['bitrate']} ${v['codec']} ${v['lang']}</option>`
      )

      videoTracksSelect.innerHTML = videoOptions.join('')
      audioTracksSelect.innerHTML = audioOptions.join('')

      mbrControls.style.display = 'block'
    },
    onError: (err) => {
      if (typeof err === 'object' && err.type) {
        console.log(err.type)
        if (err.type === 'waiting') {
          timeLineChart.push({
            x: new Date(),
            y: 10,
          })
          if (timeLineChart.length === 100) {
            timeLineChart.shift()
          }
          eventsChart.update()
        }
      } else {
        console.log('••••• ERRROR', err)
      }
    },
    onAutoplay: (func) => {
      // console.log('onAutoplay', func)
      const element = document.getElementById('playButton')
      element.style.display = 'flex'
      window.autoplayFunc = func.bind(this)
      window.addEventListener('click', window.hidePlayButton)
      window.addEventListener('touchstart', window.hidePlayButton)
    },
    onMuted: () => {
      console.log('[onMuted]')
    },
    onStats: (stats) => {
      const {endTime, currentTime, videoBuffer, audioBuffer, timestamp, readyState} = stats
      const maxElements = 30
      // graphUTCLabels.push(humanTime(stats.timestamp))
      const date = new Date(timestamp)
      graphUTCLabels.push(`${date.getMinutes()}:${date.getSeconds()}:${date.getUTCMilliseconds()}`)
      // graphCurrentTime.push(stats.currentTime)
      // graphBufferedTime.push(stats.endTime)
      graphBufferedLength.push(endTime - currentTime)
      mseVideoBufferSize.push(videoBuffer)
      mseAudioBufferSize.push(audioBuffer)
      if (graphUTCLabels.length === maxElements) {
        graphUTCLabels.shift()
      }
      // if (graphCurrentTime.length === maxElements) {
      //   graphCurrentTime.shift()
      // }
      // if (graphBufferedTime.length === maxElements) {
      //   graphBufferedTime.shift()
      // }
      if (graphBufferedLength.length === maxElements) {
        graphBufferedLength.shift()
      }
      if (mseVideoBufferSize.length === maxElements) {
        mseVideoBufferSize.shift()
      }
      if (mseAudioBufferSize.length === maxElements) {
        mseAudioBufferSize.shift()
      }

      const readyIndicator = document.getElementById('indicator')
      readyIndicator.className = ''
      switch (readyState) {
        case 0:
          readyIndicator.classList.add('black')
          break
        case 1:
          readyIndicator.classList.add('gray')
          break
        case 2:
          readyIndicator.classList.add('red')
          break
        case 3:
          readyIndicator.classList.add('yellow')
          break
        case 4:
          readyIndicator.classList.add('green')
          break
        default:
          readyIndicator.classList.add('gray')
          break
      }

      bufferLenChrt.update()
      bufferChrt.update()
    },
    onMessage: (messageStats) => {
      const {utc, messageTimeDiff} = messageStats
      messagesUTC.push(utc)
      if (messagesUTC.length === 100) {
        messagesUTC.shift()
      }
      messagesTimelag.push(messageTimeDiff)
      if (messagesTimelag.length === 100) {
        messagesTimelag.shift()
      }
      socketChart.update()
    },
  }

  window.player = new FlussonicMsePlayer(element, url, opts)
  window.play = () => {
    window.player
      .play()
      .then((success) => {
        console.log('resolve', success)
      })
      .catch((err) => {
        console.log(err)
      })
  }

  window.hidePlayButton = () => {
    const element = document.getElementById('playButton')
    element.style.display = 'none'
    window.removeEventListener('click', window.hidePlayButton)
    window.removeEventListener('touchstart', window.hidePlayButton)
    window.autoplayFunc()
  }

  window.play()

  window.setTracks = () => {
    const videoTrackId = videoTracksSelect.options[videoTracksSelect.selectedIndex].value
    const audioTrackId = audioTracksSelect.options[audioTracksSelect.selectedIndex].value
    console.log({videoTracksSelect}, videoTrackId, audioTrackId)
    window.player.setTracks([videoTrackId, audioTrackId])
  }

  window.seek = () => {
    const element = document.getElementById('seek')
    let value
    if (!element || element instanceof HTMLInputElement) {
      if (element.value === 'live') {
        value = 'live'
      } else {
        value = parseInt(element.value, 10)
        value = value > 0 ? value : void 0
      }
    }
    if (value) {
      window.player.seek(value)
    } else throw new Error('incorrect input!')
  }

  const bufferChart = document.getElementById('MSELDBuffers').getContext('2d')
  const bufferChrt = new Chart(bufferChart, {
    type: 'bar',
    data: {
      labels: graphUTCLabels,
      datasets: [
        {
          label: 'MSELD Video Buffer (bytes)',
          backgroundColor: '#FF6B00',
          borderColor: '#FF6B00',
          data: mseVideoBufferSize,
          fill: true,
        },
        {
          label: 'MSELD Audio Buffer (bytes)',
          backgroundColor: '#63d4ff',
          borderColor: '#63d4ff',
          data: mseAudioBufferSize,
          fill: true,
        },
      ],
    },
    // Configuration options go here
    options: {
      responsive: true,
      elements: {
        line: {
          tension: 0, // disables bezier curves
        },
      },
      animation: {
        duration: 100, // general animation time
      },
      hover: {
        animationDuration: 0, // duration of animations when hovering an item
      },
      responsiveAnimationDuration: 0, // animation duration after a resize
    },
  })

  const bufferLengthChart = document.getElementById('bufferLengthChart').getContext('2d')
  const bufferLenChrt = new Chart(bufferLengthChart, {
    type: 'bar',
    data: {
      labels: graphUTCLabels,
      datasets: [
        {
          label: 'Media Element have seconds in buffer',
          backgroundColor: 'red',
          borderColor: 'red',
          data: graphBufferedLength,
          fill: true,
        },
      ],
    },
    // Configuration options go here
    options: {
      responsive: true,
      elements: {
        line: {
          tension: 0, // disables bezier curves
        },
      },
      animation: {
        duration: 100, // general animation time
      },
      hover: {
        animationDuration: 0, // duration of animations when hovering an item
      },
      responsiveAnimationDuration: 0, // animation duration after a resize
    },
  })

  const socketLagChart = document.getElementById('socketLag').getContext('2d')
  const socketChart = new Chart(socketLagChart, {
    type: 'bar',
    data: {
      labels: messagesUTC,
      datasets: [
        {
          label: 'Time to next WS message in ms',
          backgroundColor: 'violet',
          borderColor: 'violet',
          data: messagesTimelag,
          fill: true,
        },
      ],
    },
    // Configuration options go here
    options: {
      responsive: true,
      elements: {
        line: {
          tension: 0, // disables bezier curves
        },
      },
      animation: {
        duration: 100, // general animation time
      },
      hover: {
        animationDuration: 0, // duration of animations when hovering an item
      },
      responsiveAnimationDuration: 0, // animation duration after a resize
    },
  })

  const eventsChartWrapper = document.getElementById('MSELDEvents').getContext('2d')
  const eventsChart = new Chart(eventsChartWrapper, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Events',
          backgroundColor: 'blue',
          borderColor: 'blue',
          data: timeLineChart,
        },
      ],
    },
    // Configuration options go here
    options: {
      responsive: true,
    },
  })
}
