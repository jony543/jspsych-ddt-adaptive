var settings = {
	debug: true,
	instructionsDuration: 500, // ms
    trialResponseTime: 3500,
    respondFasterMessageDuration: 1500,
    responseFeedbackDuration: 1000,
    fixationCrossDuration: 1500,
	timeSpans: [30, 60, 90],
	initialK: 0.013,
	maxTrendChanges: 5,
	kIncreaments: [0.005, 0.005, 0.003, 0.002, 0.001],
    leftSelectionKeyCode: 49, // 1
    rightSelectionKeyCode: 48, // 0
};

const trend = {
	NONE: 'none',
	UP: 'up',
	DOWN: 'down'
};
Object.freeze(trend);

var k_data = {};
var availableTimeSpans = settings.timeSpans;

function setup_ddt_adaptive_task() {
    for (idx in settings.timeSpans) {
    	k_data[settings.timeSpans[idx]] = {
    		k: settings.initialK,
    		trendChanges: 0,
    		trend: trend.NONE,
    		increament: settings.kIncreaments[0],
    	}
    }

    function getLLRvalue(ssr_value, k, d) {
    	return Math.floor(ssr_value * (1 + k * d));
    }

    var timeline = [];

    var instructions1 = {
        type: 'html-keyboard-response',
        stimulus: `
<h1 style="direction: rtl;"><strong>הוראות</strong></h1>
<p style="direction: rtl;">במטלה זו תתבקש/י לבצע בחירות על בסיס העדפה אישית, אין בחירה נכונה או לא נכונה.</p>
<p style="direction: rtl;">בכל פעם תוצג בפניך בחירה בין שתי אפשרויות לקבלת כסף.</p>
<p style="direction: rtl;">כאשר אפשרות אחת היא סכום נמוך יותר במועד קרוב יותר והאפשרות השניה היא סכום גבוה יותר במועד מרוחק יותר.</p>
<p style="direction: rtl;">המועדים בהם תוכל/י לקבל את הכסף הם החל מ "היום" או בעתיד בעוד 30, 60 או 90 ימים.</p>
<p style="direction: rtl;">כדי לבחור באופציה שבצד שמאל עליך ללחוץ על 1. כדי לבחור באופציה שבצד ימין עליך ללחוץ על 0.</p>
<p style="direction: rtl;">בכל פעם עומדות לרשותך 3.5 שניות להחליט, נסה/י לקבל החלטה מהר ככל האפשר.</p>        
        `,
        trial_duration: settings.instructionsDuration,
        choices: [ jsPsych.NO_KEYS ],  
        on_finish: function(data) {
        	data.trialType = 'instructions';
        },
    }

    var instructions2 = Object.assign({}, instructions1, { choices: [ 32 ], trial_duration: null });
    instructions2.stimulus += '<p style="direction: rtl;"><span style="color: #000080;"><strong>הקש/י על מקש הרווח בשביל להתחיל</strong></span></p>';
    instructions1.stimulus  += '<p style="direction: rtl; visibility:hidden;"><span style="color: #000080;"><strong>הקש/י על מקש הרווח בשביל להתחיל</strong></span></p>';

    timeline.push(instructions1);
    timeline.push(instructions2);

    var basicTrial = {
    	type: 'html-keyboard-response',
        stimulus: '',
        timeline: [
            {
                data: {
                    trialType: 'choice'                    
                },
                trial_duration: (settings.trialResponseTime > 0)? settings.trialResponseTime : undefined,
                choices: [ settings.leftSelectionKeyCode, settings.rightSelectionKeyCode ],
                on_finish: function(data) {
                    if (!data.key_press) {
                        data.choice = 'timeout';
                        jsPsych.endCurrentTimeline();
                        return;
                    }        

                    var trialTrend = trend.NONE;
                    
                    if ((data.llr_side == 'left' && data.key_press == settings.leftSelectionKeyCode) 
                        || (data.llr_side == 'right' && data.key_press == settings.rightSelectionKeyCode)) {
                        data.choice = 'llr';
                        trialTrend = trend.DOWN;
                        k_data[data.timeSpan].k = Math.max(0, k_data[data.timeSpan].k-k_data[data.timeSpan].increament);
                    } else {
                        data.choice = 'ssr';
                        trialTrend = trend.UP;
                        k_data[data.timeSpan].k += k_data[data.timeSpan].increament;
                    }

                    if (trialTrend != k_data[data.timeSpan].trend) {
                        k_data[data.timeSpan].trend = trialTrend;
                        k_data[data.timeSpan].trendChanges += 1;
                        if (k_data[data.timeSpan].trendChanges < settings.maxTrendChanges) {
                            k_data[data.timeSpan].increament = settings.kIncreaments[k_data[data.timeSpan].trendChanges];
                        } else {
                            availableTimeSpans = availableTimeSpans.filter(t => t != data.timeSpan);
                        }
                    }
                },
            },
            {
                data: {
                    trialType: 'responseFeedback'                    
                },
                trial_duration: settings.responseFeedbackDuration,
                choices: [ jsPsych.NO_KEYS ],   
            }
        ],        
        on_start: function(trial) {        	
            var feedbackCssClass = { 
                ssr: "",
                llr: ""
            };

            if (trial.data.trialType == 'responseFeedback') {
                var prevTrialData = jsPsych.data.get().last(1).values()[0];
                trial.data = Object.assign({}, prevTrialData, { trialType: 'responseFeedback' });
                feedbackCssClass[trial.data.choice] = "green-border";
            } else {
            	trial.data.timeSpan = jsPsych.randomization.sampleWithReplacement(availableTimeSpans, 1)[0];
            	trial.data.k = k_data[trial.data.timeSpan].k;
            	trial.data.ssr_value = 10;
            	trial.data.llr_value = getLLRvalue(trial.data.ssr_value, k_data[trial.data.timeSpan].k, trial.data.timeSpan) ;
                trial.data.llr_side = (Math.random() < 0.5) ? 'right': 'left';
            }

        	var option1Html = `
                <div class="ddt-selection ` + feedbackCssClass.ssr + `"">            
                    <h1 style="direction: rtl; text-align: center;">` + trial.data.ssr_value + `</h1>
                    <p style="direction: rtl; text-align: center;">היום</p>            
                </div>
            `;

        	var option2Html = `
                <div class="ddt-selection ` + feedbackCssClass.llr + `"">            
                    <h1 style="direction: rtl; text-align: center;">` + trial.data.llr_value + `</h1>
                    <p style="direction: rtl; text-align: center;">בעוד ` + trial.data.timeSpan + ` יום</p>            
                </div>
            `;


        	var html = '<div class="ddt-selections-panel" style="display: flex; flex-direction: row;">';
            var llr_side_status;
    		if (trial.data.llr_side == 'right') {
    			html += option1Html;
    			html += option2Html;
                llr_side_status = "<p>SSR | LLR (" + trial.data.timeSpan + ")</p>";
    		} else {
    			html += option2Html;
    			html += option1Html;
                llr_side_status = "<p>LLR (" + trial.data.timeSpan + ") | SSR</p>";
    		}
    		html += '</div>';

    		if (settings.debug) {
                html  += 
                    `<div class="debug-display">` +
                    llr_side_status + 
                    `<pre>` + 
                        JSON.stringify(k_data, null, 1) + 
                    `</pre></div>`;
    		}

    		trial.stimulus = html;    	    	
      	},        
    };

    var responseFasterMessage = {
        timeline: [{
            type: 'html-keyboard-response',
            data: {
                trialType: 'respond-faster'
            },
            stimulus: '<h1 style="direction: rtl;">אנא הגב/י מהר יותר!</h1>',
            trial_duration: settings.respondFasterMessageDuration,
            choices: [ jsPsych.NO_KEYS ],         
        }],
        conditional_function: function() {
            // get the data from the previous trial,
            // and check which key was pressed
            var data = jsPsych.data.get().last(1).values()[0];
            if(!!data.key_press) { 
                return false;
            } else {
                return true;
            }
        }
    }

    var fixation = {
      type: 'html-keyboard-response',
      stimulus: '<div style="font-size:60px">+</div>',
      choices: jsPsych.NO_KEYS,
      trial_duration: settings.fixationCrossDuration,
    }; 

    var trialLoop = {
        timeline: [fixation, basicTrial, responseFasterMessage],
        loop_function: function(data){
            if(availableTimeSpans.length > 0){
                return true;
            } else {
                return false;
            }
        }
    }

    timeline.push(trialLoop);

    timeline.push({
        type: 'html-keyboard-response',
        stimulus: '',
        on_start: function(trial) {
        	var html = '<p style="direction: rtl;">השלמת&nbsp;חלק&nbsp;זה&nbsp;בניסוי.<br />הקש/י על רווח על מנת להמשיך.</p>';

            if (settings.debug) {
                html  += 
                    `<div class="debug-display">` +
                    `<pre>` + 
                        JSON.stringify(k_data, null, 1) + 
                    `</pre></div>`;
            }

    		trial.stimulus = html;   
        },
        choices: [ 32 ], 
        on_finish: function(data) {
        	data.trialType = 'instructions';
        },
    });

    jsPsych.init( {
        timeline: timeline,
        //display_element: 'jspsych-display-element',
        on_finish: function() {
            var resultJson = jsPsych.data.get().json();
            jatos.submitResultData(resultJson, jatosComponentsRandomizer.startNextComponent);
        }
    });  
}

// for debug
if (!window.jatos) {
	jatos = {
		onLoad: function(func) {
			func();
		}
	}
}

jatos.onLoad(function() {
	Object.assign(settings, jatos.componentJsonInput, jatos.batchJsonInput);
    setup_ddt_adaptive_task();
});
