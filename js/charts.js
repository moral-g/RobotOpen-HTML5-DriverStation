define([
  'jquery',
  'highcharts',
], function($, highcharts){
  var buildGraph = function(){
    
    new Highcharts.Chart({
    chart: {
        renderTo: 'mainChart',
        defaultSeriesType: 'spline',
        height: 250,
        plotBorderColor: '#e3e6e8',
        plotBorderWidth: 1,
        plotBorderRadius: 0,
        backgroundColor: '',
        spacingLeft: 0,
        plotBackgroundColor: '#FFFFFF',
        marginTop: 5,
        marginBottom: 35,
        zoomType: 'x,y'
    },

    /*
     * NOTE: Highcharts is FREE for non-commercial projects only,
     * and requires the credits ("Highcharts.com" in the corner).
     *
     */
    credits: {
        style: {
            color: '#9fa2a5'
        }
    },

    title: {
        text: ''
    },

    legend: {
        align: 'left',
        floating: true,
        verticalAlign: 'top',
        borderWidth: 0,
        y: 3,
        x: 10,
        itemStyle: {
            fontSize: '11px',
            color: '#1E1E1E'
        }
    },

    yAxis: {
        title: {
            text: ''
        },
        gridLineColor: '#FAFAFA',
        opposite: true,
        labels: {
            style: {
                color: '#9fa2a5'
            }
        }
    },

    xAxis: {
        type: 'datetime',
        lineWidth: 0,
        maxZoom: 5 * 24 * 3600 * 1000, // 5 days
        tickInterval: 24 * 3600 * 1000, // 1 day
        labels: {
            formatter: function() {
                return Highcharts.dateFormat('%e', this.value);
            },
            x: 0,
            style: {
                color: '#9fa2a5'
            }
        }
    },

    plotOptions: {
        series: {
            marker: {
                lineWidth: 1, // The border of each point (defaults to white)
                radius: 4 // The thickness of each point
            },

            lineWidth: 3, // The thickness of the line between points
            shadow: false
        }
    },

    /*
     * Colors for the main lines.
     *
     * We recommend not using more lines than four in a single chart
     * like this one, but if you must, then make sure you add more colors
     * below, since otherwise you'll default to Highcharts' ugly colors :)
     */
    colors: [
        '#E35733', // orange
        '#4c97d7', // blue
        '#52d74c', // green
        '#e268de' // purple
    ],

    series: [ {
        pointStart: Date.UTC(2012,11,3),
        pointInterval: 24 * 3600 * 1000, // 1 day
        name: 'Latency (ms)',
        marker: {
            symbol: 'circle'
        },
        // Just some random data. Replace this with your own.
        data: [4, 5, 8, 9, 10, 11, 10, 8, 7, 6, 9, 10, 13, 15, 16, 18, 15, 12, 10, 9, 8, 5, 8, 9, 10, 13, 15, 14]
    }]
});
  }

  return {
    buildGraph: buildGraph
  };
});