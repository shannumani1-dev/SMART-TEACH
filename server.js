require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const app = express();

const PORT = process.env.PORT || 5000;

if (!process.env.GEMINI_API_KEY) {

    console.error(
        "ERROR: GEMINI_API_KEY is missing from backend/.env"
    );

    process.exit(1);
}


const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});


app.use(cors());

app.use(
    express.json({
        limit:"1mb"
    })
);


/* Serve Smart Teach frontend */

app.use(
    express.static(
        path.join(__dirname,"..")
    )
);


app.get("/",function(req,res){

    res.sendFile(
        path.join(
            __dirname,
            "..",
            "index.html"
        )
    );

});


/* =========================
   HEALTH CHECK
========================= */

app.get(
    "/api/health",
    function(req,res){

        res.json({

            success:true,

            message:
                "Smart Teach backend is running.",

            ai:"Gemini"

        });

    }
);


/* =========================
   CLEAN GEMINI JSON
========================= */

function cleanJSON(text){

    let cleaned =
        String(text || "").trim();


    if(cleaned.startsWith("```")){

        cleaned =
            cleaned
                .replace(
                    /^```(?:json)?\s*/i,
                    ""
                )
                .replace(
                    /\s*```$/,
                    ""
                )
                .trim();

    }


    return JSON.parse(cleaned);
}


/* =========================
   GEMINI FUNCTION
========================= */

async function generateWithGemini(prompt){

    let lastError;


    for(
        let attempt = 1;
        attempt <= 3;
        attempt++
    ){

        try{

            console.log(
                `Gemini attempt ${attempt}/3...`
            );


            const response =
                await ai.models.generateContent({

                    model:
                        "gemini-3.6-flash",

                    contents:
                        prompt,

                    config:{

                        responseMimeType:
                            "application/json"

                    }

                });


            if(!response.text){

                throw new Error(
                    "Gemini returned an empty response."
                );

            }


            return cleanJSON(
                response.text
            );


        }catch(error){

            lastError = error;


            console.error(
                `Gemini attempt ${attempt}/3 failed:`,
                error.message
            );


            if(attempt < 3){

                await new Promise(
                    function(resolve){

                        setTimeout(
                            resolve,
                            2000 * attempt
                        );

                    }
                );

            }

        }

    }


    throw (
        lastError ||
        new Error(
            "Gemini did not respond."
        )
    );

}


/* =========================
   VALIDATION
========================= */

function validInput(body){

    return (
        body &&
        body.className &&
        body.subject &&
        body.topic
    );

}


/* =========================
   QUESTION PAPER
========================= */

app.post(
    "/api/generate-questions",
    async function(req,res){

        try{

            const {
                className,
                subject,
                topic,
                count = 5,
                difficulty = "Medium",
                style = "Mixed"
            } = req.body;


            if(!validInput(req.body)){

                return res.status(400).json({

                    success:false,

                    message:
                        "Class, subject and topic are required."

                });

            }


            const numberOfQuestions =
                Math.min(
                    20,
                    Math.max(
                        1,
                        Number(count) || 5
                    )
                );


            const prompt = `

You are an expert school teacher.

Create ${numberOfQuestions}
logical and accurate questions.

Class:
${className}

Subject:
${subject}

Topic:
${topic}

Difficulty:
${difficulty}

Question style:
${style}

IMPORTANT RULES:

1. Match the student's class level.
2. Stay directly related to the topic.
3. Do not repeat questions.
4. Make answers accurate.
5. Do not use confusing wording.
6. Do not invent facts.
7. Avoid generic filler.
8. Make questions useful for a real teacher.
9. Return ONLY valid JSON.
10. Do not use markdown.

Return exactly:

{
    "questions":[
        {
            "question":"Question text",
            "answer":"Correct answer",
            "explanation":"Short explanation",
            "options":[
                "Option 1",
                "Option 2",
                "Option 3",
                "Option 4"
            ]
        }
    ]
}

`;


            const data =
                await generateWithGemini(
                    prompt
                );


            if(
                !Array.isArray(
                    data.questions
                )
            ){

                throw new Error(
                    "Invalid questions generated."
                );

            }


            res.json({

                success:true,

                data:{
                    questions:
                        data.questions.slice(
                            0,
                            numberOfQuestions
                        )
                }

            });


        }catch(error){

            console.error(
                "QUESTION PAPER ERROR:",
                error
            );


            res.status(500).json({

                success:false,

                message:
                    error.message ||
                    "Failed to generate questions."

            });

        }

    }
);


/* =========================
   QUIZ MAKER
========================= */

app.post(
    "/api/generate-quiz",
    async function(req,res){

        try{

            const {
                className,
                subject,
                topic,
                count = 5,
                difficulty = "Medium"
            } = req.body;


            if(!validInput(req.body)){

                return res.status(400).json({

                    success:false,

                    message:
                        "Class, subject and topic are required."

                });

            }


            const numberOfQuestions =
                Math.min(
                    20,
                    Math.max(
                        1,
                        Number(count) || 5
                    )
                );


            const prompt = `

Create ${numberOfQuestions}
logical multiple-choice quiz questions.

Class:
${className}

Subject:
${subject}

Topic:
${topic}

Difficulty:
${difficulty}

IMPORTANT RULES:

1. Four options for every question.
2. Exactly one correct answer.
3. Questions must be logical.
4. Match the class level.
5. Stay directly related to the topic.
6. No duplicate questions.
7. No trick questions.
8. Answers must be accurate.
9. Return ONLY valid JSON.
10. No markdown.

Return exactly:

{
    "questions":[
        {
            "question":"Question",
            "options":[
                "Option A",
                "Option B",
                "Option C",
                "Option D"
            ],
            "answer":"Exact correct option",
            "explanation":"Short explanation"
        }
    ]
}

`;


            const data =
                await generateWithGemini(
                    prompt
                );


            if(
                !Array.isArray(
                    data.questions
                )
            ){

                throw new Error(
                    "Invalid quiz generated."
                );

            }


            res.json({

                success:true,

                data:{
                    questions:
                        data.questions.slice(
                            0,
                            numberOfQuestions
                        )
                }

            });


        }catch(error){

            console.error(
                "QUIZ ERROR:",
                error
            );


            res.status(500).json({

                success:false,

                message:
                    error.message ||
                    "Failed to generate quiz."

            });

        }

    }
);


/* =========================
   WORKSHEET
========================= */

app.post(
    "/api/generate-worksheet",
    async function(req,res){

        try{

            const {
                className,
                subject,
                topic,
                count = 10
            } = req.body;


            if(!validInput(req.body)){

                return res.status(400).json({

                    success:false,

                    message:
                        "Class, subject and topic are required."

                });

            }


            const numberOfQuestions =
                Math.min(
                    20,
                    Math.max(
                        1,
                        Number(count) || 10
                    )
                );


            const prompt = `

Create ${numberOfQuestions}
useful classroom worksheet questions.

Class:
${className}

Subject:
${subject}

Topic:
${topic}

IMPORTANT RULES:

1. Match the class level.
2. Stay on topic.
3. Make questions logical.
4. Avoid repetition.
5. Include accurate answers.
6. Use a mixture of suitable practice questions.
7. Return ONLY valid JSON.
8. No markdown.

Return exactly:

{
    "questions":[
        {
            "question":"Question",
            "answer":"Answer",
            "explanation":"Short explanation",
            "options":[]
        }
    ]
}

`;


            const data =
                await generateWithGemini(
                    prompt
                );


            if(
                !Array.isArray(
                    data.questions
                )
            ){

                throw new Error(
                    "Invalid worksheet generated."
                );

            }


            res.json({

                success:true,

                data:{
                    questions:
                        data.questions.slice(
                            0,
                            numberOfQuestions
                        )
                }

            });


        }catch(error){

            console.error(
                "WORKSHEET ERROR:",
                error
            );


            res.status(500).json({

                success:false,

                message:
                    error.message ||
                    "Failed to generate worksheet."

            });

        }

    }
);


/* =========================
   LESSON PLANNER
========================= */

app.post(
    "/api/generate-lesson",
    async function(req,res){

        try{

            const {
                className,
                subject,
                topic,
                objective,
                duration = "45 minutes"
            } = req.body;


            if(!validInput(req.body)){

                return res.status(400).json({

                    success:false,

                    message:
                        "Class, subject and topic are required."

                });

            }


            const prompt = `

You are an experienced school teacher
and lesson-plan designer.

Create a complete, practical,
logical lesson plan.

Class:
${className}

Subject:
${subject}

Topic:
${topic}

Teacher objective:
${
    objective ||
    "Help students understand the topic clearly."
}

Duration:
${duration}

IMPORTANT RULES:

1. The lesson must match the student's class.
2. Everything must relate directly to the topic.
3. Activities must be realistic for a normal classroom.
4. Use simple teacher-friendly language.
5. Include approximate time.
6. Include teacher activities.
7. Include student activities.
8. Include useful questions.
9. Include assessment.
10. Include homework.
11. Include classroom materials.
12. Avoid generic filler.
13. Return ONLY valid JSON.
14. Do not use markdown.

Return exactly:

{
    "title":"Lesson Plan - Topic",
    "className":"Class",
    "subject":"Subject",
    "topic":"Topic",
    "duration":"Duration",
    "objective":"Learning objective",

    "sections":[

        {
            "title":"Introduction",
            "time":"5 minutes",
            "teacherActivity":"What teacher does",
            "studentActivity":"What students do",
            "questions":[
                "Useful question"
            ]
        },

        {
            "title":"Explanation",
            "time":"15 minutes",
            "teacherActivity":"What teacher explains",
            "studentActivity":"What students do",
            "questions":[
                "Useful question"
            ]
        },

        {
            "title":"Guided Practice",
            "time":"10 minutes",
            "teacherActivity":"Teacher guidance",
            "studentActivity":"Student practice",
            "questions":[
                "Practice question"
            ]
        },

        {
            "title":"Independent Practice",
            "time":"10 minutes",
            "teacherActivity":"Teacher instructions",
            "studentActivity":"Independent student work",
            "questions":[
                "Practice question"
            ]
        },

        {
            "title":"Assessment",
            "time":"5 minutes",
            "teacherActivity":"Assessment method",
            "studentActivity":"Student response",
            "questions":[
                "Assessment question"
            ]
        }

    ],

    "homework":[
        "Homework task"
    ],

    "materials":[
        "Required classroom material"
    ]
}

`;


            const data =
                await generateWithGemini(
                    prompt
                );


            if(
                !Array.isArray(
                    data.sections
                )
            ){

                throw new Error(
                    "Invalid lesson plan generated."
                );

            }


            res.json({

                success:true,

                data:data

            });


        }catch(error){

            console.error(
                "LESSON PLAN ERROR:",
                error
            );


            res.status(500).json({

                success:false,

                message:
                    error.message ||
                    "Failed to generate lesson plan."

            });

        }

    }
);


/* =========================
   START SERVER
========================= */

app.listen(
    PORT,
    function(){

        console.log(
            `Smart Teach backend running at http://localhost:${PORT}`
        );

    }
);