/* =========================================================
   MIND MAP GENERATOR
   Version 6 — Structured Mind Map Layout
========================================================= */


/* =========================================================
   DOM
========================================================= */

const markdownInput =
    document.getElementById("markdownInput");

const generateButton =
    document.getElementById("generateButton");

const imageInput =
    document.getElementById("imageInput");

const imagePreview =
    document.getElementById("imagePreview");

const inputPanel =
    document.getElementById("inputPanel");

const mapPanel =
    document.getElementById("mapPanel");

const svg =
    d3.select("#mindMap");


/* =========================================================
   STATE
========================================================= */

let root = null;

let zoomBehaviour = null;

let currentImage = null;


/* =========================================================
   IMAGE HANDLING
========================================================= */

imageInput.addEventListener(
    "change",
    function () {

        const file =
            this.files[0];

        if (!file) {

            currentImage = null;

            imagePreview.style.display =
                "none";

            imagePreview.innerHTML =
                "";

            return;
        }

        const reader =
            new FileReader();

        reader.onload =
            function (event) {

                currentImage =
                    event.target.result;

                imagePreview.innerHTML =
                    `<img src="${currentImage}" alt="Map image">`;

                imagePreview.style.display =
                    "block";
            };

        reader.readAsDataURL(file);
    }
);


/* =========================================================
   MARKDOWN PARSER
========================================================= */

function parseMarkdown(markdown) {

    const lines =
        markdown
            .replace(/\r\n/g, "\n")
            .split("\n");

    let root =
        null;

    const stack =
        [];

    for (
        let rawLine of lines
    ) {

        const line =
            rawLine.replace(
                /\t/g,
                "    "
            );

        if (!line.trim()) {
            continue;
        }


        /* =================================================
           HEADINGS
        ================================================= */

        const headingMatch =
            line.match(
                /^(#{1,6})\s+(.+)$/
            );

        if (headingMatch) {

            const level =
                headingMatch[1].length;

            const title =
                headingMatch[2].trim();

            const node = {

                title:
                    title,

                level:
                    level,

                type:
                    "heading",

                children:
                    [],

                collapsed:
                    false
            };


            /* ---------------------------------------------
               ROOT
            --------------------------------------------- */

            if (
                level === 1 ||
                !root
            ) {

                if (!root) {
                    root = node;
                }

                stack.length =
                    0;

                stack.push(
                    node
                );

                continue;
            }


            /* ---------------------------------------------
               FIND PARENT
            --------------------------------------------- */

            while (
                stack.length > 0 &&
                stack[
                    stack.length - 1
                ].level >= level
            ) {

                stack.pop();
            }


            const parent =
                stack[
                    stack.length - 1
                ];


            if (parent) {

                parent.children.push(
                    node
                );

                stack.push(
                    node
                );
            }

            continue;
        }


        /* =================================================
           BULLETS
        ================================================= */

        const bulletMatch =
            line.match(
                /^\s*[-*+]\s+(.+)$/
            );

        if (bulletMatch) {

            const node = {

                title:
                    bulletMatch[1].trim(),

                level:
                    null,

                type:
                    "detail",

                children:
                    [],

                collapsed:
                    false
            };


            const parent =
                stack[
                    stack.length - 1
                ];


            if (parent) {

                parent.children.push(
                    node
                );
            }
        }
    }

    return root;
}


/* =========================================================
   BRANCH COLORS
========================================================= */

function branchColor(node) {

    const colors = [

        "#3977c9",
        "#4f9a5a",
        "#d99427",
        "#8757a8",
        "#c45b5b",
        "#328f8f"

    ];


    let branch =
        node;


    while (
        branch.parent &&
        branch.parent.depth > 0
    ) {

        branch =
            branch.parent;
    }


    if (
        branch.parent &&
        branch.parent.children
    ) {

        const index =
            branch.parent.children.indexOf(
                branch
            );

        return colors[
            index % colors.length
        ];
    }


    return colors[0];
}


/* =========================================================
   NODE WIDTH
========================================================= */

function nodeWidth(d) {

    if (d.depth === 0) {
        return 330;
    }

    if (d.depth === 1) {
        return 280;
    }

    if (d.depth === 2) {
        return 235;
    }

    return 205;
}


/* =========================================================
   NODE HEIGHT
========================================================= */

function nodeHeight(d) {

    if (d.depth === 0) {
        return 115;
    }

    if (d.depth === 1) {
        return 72;
    }

    if (d.depth === 2) {
        return 58;
    }

    return 48;
}


/* =========================================================
   TEXT WRAPPING
========================================================= */

function wrapNodeText(
    selection,
    width
) {

    selection.each(
        function (d) {

            const text =
                d3.select(this);

            const words =
                d.data.title
                    .split(/\s+/)
                    .reverse();

            let word;

            let line = [];

            const lineHeight =
                d.depth === 0
                    ? 25
                    : d.depth === 1
                        ? 19
                        : 16;

            const lines = [];


            while (
                (word = words.pop())
            ) {

                line.push(word);

                const test =
                    line.join(" ");

                const estimatedWidth =
                    test.length *
                    (
                        d.depth === 0
                            ? 12
                            : d.depth === 1
                                ? 8.5
                                : 7
                    );


                if (
                    estimatedWidth > width &&
                    line.length > 1
                ) {

                    line.pop();

                    lines.push(
                        line.join(" ")
                    );

                    line = [
                        word
                    ];
                }
            }


            if (line.length) {

                lines.push(
                    line.join(" ")
                );
            }


            const totalHeight =
                (
                    lines.length - 1
                ) *
                lineHeight;


            text.text(null);


            lines.forEach(
                function (
                    lineText,
                    index
                ) {

                    text
                        .append("tspan")
                        .attr(
                            "x",
                            0
                        )
                        .attr(
                            "dy",
                            index === 0
                                ? `${-totalHeight / 2}px`
                                : `${lineHeight}px`
                        )
                        .text(
                            lineText
                        );
                }
            );
        }
    );
}


/* =========================================================
   STRUCTURED LAYOUT
========================================================= */

/*
   This is the important change in Version 6.

   We still use D3 to calculate the natural tree structure,
   but we then give each depth its own horizontal position.

   Root
       0

   Primary
       250

   Secondary
       535

   Detail
       800

   This means moving a primary branch does NOT squeeze
   its secondary branches against it.
*/

function applyStructuredLayout(root) {

    if (!root) {
        return;
    }


    /* =====================================================
       HORIZONTAL DEPTH POSITIONS
    ===================================================== */

    const depthPositions = {

        0: 0,

        1: 250,

        2: 535,

        3: 800,

        4: 1045,

        5: 1280
    };


    root.each(
        function (d) {

            if (
                depthPositions[
                    d.depth
                ] !== undefined
            ) {

                d.y =
                    depthPositions[
                        d.depth
                    ];
            }
            else {

                d.y =
                    1280 +
                    (
                        d.depth - 5
                    ) *
                    235;
            }
        }
    );


    /* =====================================================
       PRIMARY BRANCH POSITIONS
    ===================================================== */

    if (
        !root.children ||
        root.children.length === 0
    ) {

        return;
    }


    const primaryBranches =
        root.children;


    /*
       We want the primary branches to sit around
       the root rather than being stretched from
       the top to the bottom of the map.
    */

    const primarySpacing =
        150;


    const primaryCentre =
        (
            primaryBranches.length - 1
        ) / 2;


    primaryBranches.forEach(
        function (
            branch,
            index
        ) {

            const desiredX =
                (
                    index -
                    primaryCentre
                ) *
                primarySpacing;


            const shift =
                desiredX -
                branch.x;


            /*
               Move the entire branch together.

               This preserves the internal structure
               calculated by D3.
            */

            branch.each(
                function (d) {

                    d.x +=
                        shift;
                }
            );
        }
    );


    /* =====================================================
       SECONDARY BRANCH BREATHING ROOM
    ===================================================== */

    primaryBranches.forEach(
        function (branch) {

            if (
                !branch.children ||
                branch.children.length < 2
            ) {

                return;
            }


            const secondaryChildren =
                branch.children;


            const secondarySpacing =
                90;


            const secondaryCentre =
                (
                    secondaryChildren.length - 1
                ) / 2;


            secondaryChildren.forEach(
                function (
                    child,
                    index
                ) {

                    const desiredX =
                        branch.x +
                        (
                            index -
                            secondaryCentre
                        ) *
                        secondarySpacing;


                    const shift =
                        desiredX -
                        child.x;


                    child.each(
                        function (d) {

                            d.x +=
                                shift;
                        }
                    );
                }
            );
        }
    );


    /* =====================================================
       COLLISION CHECK
    ===================================================== */

    const visibleNodes =
        root.descendants();


    /*
       Sort by vertical position.
    */

    visibleNodes.sort(
        function (a, b) {

            return a.x - b.x;
        }
    );


    /*
       Prevent cards at the same depth from
       physically overlapping.
    */

    for (
        let i = 1;
        i < visibleNodes.length;
        i++
    ) {

        const previous =
            visibleNodes[i - 1];

        const current =
            visibleNodes[i];


        if (
            previous.depth !==
            current.depth
        ) {

            continue;
        }


        const minimumGap =
            (
                nodeHeight(previous) +
                nodeHeight(current)
            ) /
            2 +
            24;


        const actualGap =
            current.x -
            previous.x;


        if (
            actualGap <
            minimumGap
        ) {

            const adjustment =
                minimumGap -
                actualGap;


            /*
               Move this node and everything
               below it together.
            */

            current.each(
                function (d) {

                    d.x +=
                        adjustment;
                }
            );
        }
    }


    /* =====================================================
       RE-CENTRE PRIMARY GROUP
    ===================================================== */

    const firstPrimary =
        primaryBranches[0];

    const lastPrimary =
        primaryBranches[
            primaryBranches.length - 1
        ];


    const groupCentre =
        (
            firstPrimary.x +
            lastPrimary.x
        ) / 2;


    const correction =
        -groupCentre;


    primaryBranches.forEach(
        function (branch) {

            branch.each(
                function (d) {

                    d.x +=
                        correction;
                }
            );
        }
    );
}


/* =========================================================
   RENDER
========================================================= */

function renderMindMap(
    tree,
    fitAfterRender = false
) {

    /*
       Preserve the current camera.

       Expanding or collapsing a branch should NOT
       automatically zoom the user back to Fit Map.
    */

    const previousTransform =
        d3.zoomTransform(
            svg.node()
        );


    svg.selectAll("*")
        .remove();


    if (!tree) {
        return;
    }


    const container =
        svg.append("g")
            .attr(
                "class",
                "map-container"
            );


    /* =====================================================
       ZOOM
    ===================================================== */

    zoomBehaviour =
        d3.zoom()

            .scaleExtent([
                0.35,
                3
            ])

            .on(
                "zoom",
                function (event) {

                    container.attr(
                        "transform",
                        event.transform
                    );
                }
            );


    svg.call(
        zoomBehaviour
    );


    /*
       Restore camera after expansion/collapse.
    */

    if (!fitAfterRender) {

        svg.call(
            zoomBehaviour.transform,
            previousTransform
        );
    }


    /* =====================================================
       HIERARCHY
    ===================================================== */

    root =
        d3.hierarchy(
            tree,
            function (node) {

                if (
                    node.collapsed
                ) {

                    return null;
                }

                return node.children;
            }
        );


    /* =====================================================
       BASE D3 TREE
    ===================================================== */

    const layout =
        d3.tree()
            .nodeSize([
                115,
                300
            ]);


    layout(root);


    /* =====================================================
       ROOT ANCHOR
    ===================================================== */

    const originalRootX =
        root.x;


    root.each(
        function (d) {

            d.x =
                d.x -
                originalRootX;
        }
    );


    /*
       Now replace the generic D3 depth positioning
       with our structured mind-map layout.
    */

    applyStructuredLayout(
        root
    );


    /* =====================================================
       LINKS
    ===================================================== */

    const linkGroup =
        container
            .append("g")
            .attr(
                "class",
                "links"
            );


    linkGroup
        .selectAll("path")
        .data(
            root.links()
        )
        .join("path")

        .attr(
            "class",
            "map-link"
        )

        .attr(
            "fill",
            "none"
        )

        .attr(
            "stroke",
            function (d) {

                if (
                    d.target.depth === 1
                ) {

                    return branchColor(
                        d.target
                    );
                }

                return "#c4c7ca";
            }
        )

        .attr(
            "stroke-width",
            function (d) {

                if (
                    d.target.depth === 1
                ) {

                    return 4;
                }


                if (
                    d.target.depth === 2
                ) {

                    return 2.5;
                }


                return 1.5;
            }
        )

        .attr(
            "stroke-linecap",
            "round"
        )

        .attr(
            "d",
            function (d) {

                const sourceRight =
                    d.source.y +
                    nodeWidth(d.source) / 2;


                const targetLeft =
                    d.target.y -
                    nodeWidth(d.target) / 2;


                const x1 =
                    sourceRight;

                const x2 =
                    targetLeft;


                const middle =
                    (
                        x1 +
                        x2
                    ) / 2;


                return `
                    M ${x1},${d.source.x}
                    C ${middle},${d.source.x}
                      ${middle},${d.target.x}
                      ${x2},${d.target.x}
                `;
            }
        );


    /* =====================================================
       NODES
    ===================================================== */

    const nodeGroup =
        container
            .append("g")
            .attr(
                "class",
                "nodes"
            );


    const nodes =
        nodeGroup

            .selectAll("g")

            .data(
                root.descendants()
            )

            .join("g")

            .attr(
                "class",
                function (d) {

                    if (
                        d.depth === 0
                    ) {

                        return "mind-node root-node";
                    }


                    if (
                        d.depth === 1
                    ) {

                        return "mind-node major-node";
                    }


                    if (
                        d.depth === 2
                    ) {

                        return "mind-node secondary-node";
                    }


                    return "mind-node detail-node";
                }
            )

            .attr(
                "transform",
                function (d) {

                    return `
                        translate(
                            ${d.y},
                            ${d.x}
                        )
                    `;
                }
            );


    /* =====================================================
       NODE CARD
    ===================================================== */

    nodes

        .append("rect")

        .attr(
            "class",
            "node-card"
        )

        .attr(
            "x",
            function (d) {

                return -
                    nodeWidth(d) /
                    2;
            }
        )

        .attr(
            "y",
            function (d) {

                return -
                    nodeHeight(d) /
                    2;
            }
        )

        .attr(
            "width",
            function (d) {

                return nodeWidth(d);
            }
        )

        .attr(
            "height",
            function (d) {

                return nodeHeight(d);
            }
        )

        .attr(
            "rx",
            function (d) {

                return d.depth === 0
                    ? 20
                    : 14;
            }
        )

        .attr(
            "ry",
            function (d) {

                return d.depth === 0
                    ? 20
                    : 14;
            }
        )

        .attr(
            "fill",
            "#ffffff"
        )

        .attr(
            "stroke",
            function (d) {

                if (
                    d.depth === 0
                ) {

                    return "#20242a";
                }


                if (
                    d.depth === 1
                ) {

                    return branchColor(
                        d
                    );
                }


                return "#d3d6da";
            }
        )

        .attr(
            "stroke-width",
            function (d) {

                if (
                    d.depth === 0
                ) {

                    return 3;
                }


                if (
                    d.depth === 1
                ) {

                    return 2.5;
                }


                return 1.5;
            }
        );


    /* =====================================================
       COLOURED PRIMARY ACCENT
    ===================================================== */

    nodes

        .filter(
            function (d) {

                return d.depth === 1;
            }
        )

        .append("rect")

        .attr(
            "class",
            "node-accent"
        )

        .attr(
            "x",
            function (d) {

                return -
                    nodeWidth(d) /
                    2;
            }
        )

        .attr(
            "y",
            function (d) {

                return -
                    nodeHeight(d) /
                    2;
            }
        )

        .attr(
            "width",
            7
        )

        .attr(
            "height",
            function (d) {

                return nodeHeight(d);
            }
        )

        .attr(
            "rx",
            3
        )

        .attr(
            "fill",
            function (d) {

                return branchColor(
                    d
                );
            }
        );


    /* =====================================================
       TEXT
    ===================================================== */

    const nodeText =
        nodes

            .append("text")

            .attr(
                "class",
                function (d) {

                    if (
                        d.depth === 0
                    ) {

                        return "node-title root-title";
                    }


                    if (
                        d.data.type ===
                        "detail"
                    ) {

                        return "node-detail";
                    }


                    return "node-title";
                }
            )

            .attr(
                "text-anchor",
                "middle"
            )

            .attr(
                "dominant-baseline",
                "middle"
            )

            .attr(
                "font-size",
                function (d) {

                    if (
                        d.depth === 0
                    ) {

                        return "24px";
                    }


                    if (
                        d.depth === 1
                    ) {

                        return "17px";
                    }


                    if (
                        d.depth === 2
                    ) {

                        return "14px";
                    }


                    return "12px";
                }
            )

            .attr(
                "font-weight",
                function (d) {

                    return d.depth <= 1
                        ? 700
                        : 400;
                }
            )

            .attr(
                "fill",
                function (d) {

                    if (
                        d.depth === 0
                    ) {

                        return "#20242a";
                    }


                    if (
                        d.data.type ===
                        "detail"
                    ) {

                        return "#62676d";
                    }


                    return "#252a30";
                }
            );


    wrapNodeText(
        nodeText,
        200
    );


    /* =====================================================
       EXPAND / COLLAPSE
    ===================================================== */

    const expandable =
        nodes.filter(
            function (d) {

                return (
                    d.data.children &&
                    d.data.children.length > 0
                );
            }
        );


    /* =====================================================
       CONTROL CIRCLE
    ===================================================== */

    expandable

        .append("circle")

        .attr(
            "class",
            "expand-button"
        )

        .attr(
            "cx",
            function (d) {

                return (
                    nodeWidth(d) /
                    2 -
                    18
                );
            }
        )

        .attr(
            "cy",
            function (d) {

                return (
                    -
                    nodeHeight(d) /
                    2 +
                    18
                );
            }
        )

        .attr(
            "r",
            12
        )

        .attr(
            "fill",
            "#ffffff"
        )

        .attr(
            "stroke",
            function (d) {

                return branchColor(
                    d
                );
            }
        )

        .attr(
            "stroke-width",
            2
        );


    /* =====================================================
       PLUS / MINUS
    ===================================================== */

    expandable

        .append("text")

        .attr(
            "class",
            "expand-symbol"
        )

        .attr(
            "x",
            function (d) {

                return (
                    nodeWidth(d) /
                    2 -
                    18
                );
            }
        )

        .attr(
            "y",
            function (d) {

                return (
                    -
                    nodeHeight(d) /
                    2 +
                    19
                );
            }
        )

        .attr(
            "text-anchor",
            "middle"
        )

        .attr(
            "dominant-baseline",
            "middle"
        )

        .attr(
            "font-size",
            "13px"
        )

        .attr(
            "font-weight",
            "700"
        )

        .attr(
            "fill",
            function (d) {

                return branchColor(
                    d
                );
            }
        )

        .text(
            function (d) {

                return d.data.collapsed
                    ? "+"
                    : "−";
            }
        );


    /* =====================================================
       ROOT IMAGE
    ===================================================== */

    if (currentImage) {

        const rootNode =
            nodes.filter(
                function (d) {

                    return d.depth === 0;
                }
            );


        rootNode

            .append("clipPath")

            .attr(
                "id",
                "root-image-clip"
            )

            .append("rect")

            .attr(
                "x",
                -
                nodeWidth(root) /
                2 +
                14
            )

            .attr(
                "y",
                -
                nodeHeight(root) /
                2 +
                14
            )

            .attr(
                "width",
                70
            )

            .attr(
                "height",
                nodeHeight(root) -
                28
            )

            .attr(
                "rx",
                10
            );


        rootNode

            .append("image")

            .attr(
                "href",
                currentImage
            )

            .attr(
                "class",
                "root-image"
            )

            .attr(
                "x",
                -
                nodeWidth(root) /
                2 +
                14
            )

            .attr(
                "y",
                -
                nodeHeight(root) /
                2 +
                14
            )

            .attr(
                "width",
                70
            )

            .attr(
                "height",
                nodeHeight(root) -
                28
            )

            .attr(
                "preserveAspectRatio",
                "xMidYMid slice"
            )

            .attr(
                "clip-path",
                "url(#root-image-clip)"
            );
    }


    /* =====================================================
       EXPAND / COLLAPSE CLICK
    ===================================================== */

    expandable.on(
        "click",
        function (
            event,
            d
        ) {

            event.stopPropagation();


            d.data.collapsed =
                !d.data.collapsed;


            renderMindMap(
                tree,
                false
            );
        }
    );


    /* =====================================================
       INITIAL FIT
    ===================================================== */

    if (
        fitAfterRender
    ) {

        setTimeout(
            function () {

                fitMap();

            },
            50
        );
    }
}


/* =========================================================
   FIT MAP
========================================================= */

function fitMap() {

    if (!root) {
        return;
    }


    const container =
        d3.select(
            "#mindMap .map-container"
        );


    if (
        !container.node()
    ) {

        return;
    }


    const width =
        svg.node().clientWidth;

    const height =
        svg.node().clientHeight;


    const bounds =
        container
            .node()
            .getBBox();


    /*
       The root is always the visual anchor.
    */

    const rootX =
        root.y;


    const horizontalSpace =
        bounds.width +
        160;


    const verticalSpace =
        bounds.height +
        120;


    const horizontalScale =
        (
            width *
            0.88
        ) /
        horizontalSpace;


    const verticalScale =
        (
            height *
            0.88
        ) /
        verticalSpace;


    let scale =
        Math.min(
            horizontalScale,
            verticalScale
        );


    scale =
        Math.max(
            scale,
            0.55
        );


    scale =
        Math.min(
            scale,
            1.15
        );


    /*
       Put root around 27% from the left.
    */

    const desiredRootX =
        width *
        0.27;


    const desiredRootY =
        height *
        0.50;


    const translateX =
        desiredRootX -
        (
            rootX *
            scale
        );


    const translateY =
        desiredRootY;


    svg.transition()

        .duration(450)

        .call(
            zoomBehaviour.transform,

            d3.zoomIdentity

                .translate(
                    translateX,
                    translateY
                )

                .scale(
                    scale
                )
        );
}


/* =========================================================
   ZOOM IN
========================================================= */

document
    .getElementById(
        "zoomInButton"
    )
    .addEventListener(
        "click",
        function () {

            if (!zoomBehaviour) {
                return;
            }


            svg.transition()
                .call(
                    zoomBehaviour.scaleBy,
                    1.25
                );
        }
    );


/* =========================================================
   ZOOM OUT
========================================================= */

document
    .getElementById(
        "zoomOutButton"
    )
    .addEventListener(
        "click",
        function () {

            if (!zoomBehaviour) {
                return;
            }


            svg.transition()
                .call(
                    zoomBehaviour.scaleBy,
                    0.8
                );
        }
    );


/* =========================================================
   FIT BUTTON
========================================================= */

document
    .getElementById(
        "fitButton"
    )
    .addEventListener(
        "click",
        function () {

            fitMap();
        }
    );


/* =========================================================
   GENERATE
========================================================= */

generateButton.addEventListener(
    "click",
    function () {

        const markdown =
            markdownInput.value.trim();


        if (!markdown) {

            alert(
                "Please enter a Markdown mind map first."
            );

            return;
        }


        const tree =
            parseMarkdown(
                markdown
            );


        if (!tree) {

            alert(
                "The Markdown could not be interpreted."
            );

            return;
        }


        inputPanel.classList.add(
            "hidden"
        );


        mapPanel.classList.remove(
            "hidden"
        );


        renderMindMap(
            tree,
            true
        );
    }
);
