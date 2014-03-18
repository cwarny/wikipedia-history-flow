function buildSketchFunction(passedData) {
	return function($p) {

		var Revision = (function() {
			function Revision() {
				var $this_1 = this;

				function $superCstr() {
					$p.extendClassChain($this_1)
				}
				
				$this_1.timestamp = null;
				$this_1.id = 0;
				$this_1.x = 0;
				$this_1.w = 0;
				$this_1.size = 0;
				$this_1.txt = null;
				$this_1.nLines = 0;
				$this_1.contributions = new $p.ArrayList();

				function update$2(prevX, prevW) {
					$this_1.x = prevX + prevW;
					if ($p.mouseX / xScale >= $this_1.x && $p.mouseX / xScale < $this_1.x + $this_1.w) {
						$this_1.w = revWidth * 10;
						selectedRevision = $this_1.$self;
					} else {
						$this_1.w = revWidth;
					}
				}
				
				$p.addMethod($this_1, 'update', update$2);

				function render$0() {
					for (var $it0 = new $p.ObjectIterator($this_1.contributions), contrib = void(0); $it0.hasNext() && ((contrib = $it0.next()) || true);) {
						contrib.render();
					}
				}
				$p.addMethod($this_1, 'render', render$0);

				function $constr_1(rev) {
					$superCstr();

					$this_1.w = revWidth;
					$this_1.timestamp = new Date(rev.timestamp);
					$this_1.id = $p.parseFloat(rev._id);
					$this_1.x = $this_1.id * $this_1.w;
					$this_1.txt = rev.text;
					for (var i=0; i<rev.contributions.length; i++) {
						var c = new Contribution(rev.contributions[i], $this_1);
						$this_1.nLines += c.nLines;
						if (i == rev.contributions.length - 1) $this_1.size = (mainChartHeight - c.y1start) + c.leng;
						$this_1.contributions.add(c);
					}

					if ($this_1.size > absoluteMaxSize) absoluteMaxSize = $this_1.size;
				}

				function $constr() {
					if (arguments.length === 1) {
						$constr_1.apply($this_1, arguments);
					} else $superCstr();
				}
				$constr.apply(null, arguments);
			}
			return Revision;
		})();

		$p.Revision = Revision;

		var Contribution = (function() {
			function Contribution() {
				var $this_1 = this;

				function $superCstr() {
					$p.extendClassChain($this_1)
				}
				$this_1.rev = null;
				$this_1.contributor = null;
				$this_1.timestamp = null;
				$this_1.y1start = 0;
				$this_1.y1stop = 0;
				$this_1.y0start = 0;
				$this_1.y0stop = 0;
				$this_1.start = 0;
				$this_1.leng = 0;
				$this_1.slope = 0;
				$this_1.x0 = 0;
				$this_1.x1 = 0;
				$this_1.nLines = 1;

				function calcNLines$0() {
					var stop = $this_1.start + $this_1.leng;
					var snippet = $this_1.rev.txt.slice($this_1.start, stop);
					var tokens = $p.splitTokens(snippet);
					var lineX = 0;
					for (var i = 0; i < tokens.length; i++) {
						if (lineX + $p.textWidth(tokens[i]) > textAreaWidth) {
							$this_1.nLines++;
							lineX = $p.textWidth(tokens[i] + " ");
						} else if (lineX + $p.textWidth(tokens[i]) == textAreaWidth) {
							$this_1.nLines++;
							lineX = 0;
						} else {
							lineX += $p.textWidth(tokens[i] + " ");
						}
					}

					var matches = snippet.match(patt);
					if (matches !== null) $this_1.nLines += matches.length;
				}

				$p.addMethod($this_1, 'calcNLines', calcNLines$0);

				function render$0() {
					$this_1.x0 = $this_1.rev.x;
					$this_1.x1 = $this_1.x0 + $this_1.rev.w;
					$p.fill($this_1.contributor.col);
					if (!$p.__equals($this_1.timestamp, $this_1.rev.timestamp)) {
						$p.beginShape();
						$p.vertex($this_1.x0, $this_1.y0start);
						$p.vertex($this_1.x1, $this_1.y1start);
						$p.vertex($this_1.x1, $this_1.y1stop);
						$p.vertex($this_1.x0, $this_1.y0stop);
						$p.endShape($p.CLOSE);
					} else {
						$p.rect($this_1.x1, $this_1.y1stop, 1, $this_1.leng);
					}
				}

				$p.addMethod($this_1, 'render', render$0);

				function $constr_2(contrib, rev) {
					$superCstr();

					$this_1.rev = rev;
					$this_1.timestamp = new Date(contrib.timestamp);

					$this_1.leng = contrib.leng;
					$this_1.start = contrib.start;
					$this_1.$self.calcNLines();

					$this_1.y1start = mainChartHeight - $this_1.start;
					$this_1.y1stop = $this_1.y1start - $this_1.leng;
					$this_1.slope = contrib.slope;
					$this_1.y0stop = $this_1.y1stop + $this_1.slope;
					$this_1.y0start = $this_1.y1start + $this_1.slope;

					var id = null;
					if (contrib.contributor.hasOwnProperty("username")) id = contrib.contributor.username;
					else id = contrib.contributor.ip;
					if (!contributors.containsKey(id)) {
						$this_1.contributor = new Contributor(id);
						contributors.put(id, $this_1.contributor);
					} else {
						$this_1.contributor = contributors.get(id);
					}
				}

				function $constr() {
					if (arguments.length === 2) {
						$constr_2.apply($this_1, arguments);
					} else $superCstr();
				}

				$constr.apply(null, arguments);

			}
			return Contribution;
		})();
		
		$p.Contribution = Contribution;
		
		var Contributor = (function() {
			function Contributor() {
				var $this_1 = this;

				function $superCstr() {
					$p.extendClassChain($this_1)
				}
				$this_1.id = null;
				$this_1.col = 0x00000000;

				function $constr_1(id) {
					$superCstr();

					$this_1.id = id;
					$this_1.col = $p.color($p.random(255), $p.random(255), $p.random(255));
				}

				function $constr() {
					if (arguments.length === 1) {
						$constr_1.apply($this_1, arguments);
					} else $superCstr();
				}
				$constr.apply(null, arguments);
			}
			return Contributor;
		})();
	
		$p.Contributor = Contributor;

		var contributors = new $p.HashMap();
		var revisions = new $p.ArrayList();
		var revisionCount = 0;
		var xScale = 0,
			yScale = 0;
		var timeStart = 0;
		var timeWindowLength = 100;
		var revWidth = 0;
		var relativeMaxSize = 0;
		var absoluteMaxSize = $p.MIN_FLOAT;
		var bottomChartHeight = 200;
		var mainChartHeight = 0;
		var textAreaWidth = 400;
		var rectX = 0,
			rectW = 0;
		var selectedRevision = null;
		var a = 0,
			d = 0;
		var patt = /\n|\r/mg;
		var data = passedData;

		function setup() {
			$p.background(0);
			$p.size(1200, 640);
			revisionCount = data.length;
			initGlobalVariables();
			for (var i = data.length - 1; i >= 0; i--) {
				revisions.add(new Revision(data[i]));
				data.splice(i, 1);
			}
			revisions = _.sortBy(revisions.toArray(), function(rev) {
				return rev.id;
			});
		}
	
		$p.setup = setup;

		function draw() {
			$p.background(0);
			updateScales();
			renderMainChart();
			renderBottomChart();
			renderSelectedRevision();
		}
	
		$p.draw = draw;

		function mousePressed() {
			if ($p.mouseY > mainChartHeight && $p.mouseY < $p.height && ($p.mouseX < rectX || $p.mouseX > rectX + rectW)) {
				rectX = $p.mouseX;
				timeStart = $p.map(rectX, 0, $p.width - textAreaWidth, 0, revisionCount);
			}
		}

		$p.mousePressed = mousePressed;

		function mouseDragged() {
			if ($p.mouseY > mainChartHeight && $p.mouseY < $p.height && $p.mouseX > rectX && $p.mouseX < rectX + rectW) {
				rectX = rectX + ($p.mouseX - $p.pmouseX);
				timeStart = $p.map(rectX, 0, $p.width - textAreaWidth, 0, revisionCount);
			}
		}
	
		$p.mouseDragged = mouseDragged;

		function initGlobalVariables() {
			mainChartHeight = $p.height - bottomChartHeight;
			a = $p.textAscent();
			d = $p.textDescent();
			$p.textLeading(a);
			revWidth = timeWindowLength / 100;
			rectW = $p.map(timeWindowLength, 0, revisionCount, 0, $p.width - textAreaWidth);
		}
	
		$p.initGlobalVariables = initGlobalVariables;

		function updateScales() {
			relativeMaxSize = 0;
			for (var $it1 = new $p.ObjectIterator(revisions), rev = void(0); $it1.hasNext() && ((rev = $it1.next()) || true);) {
				if (rev.id > timeStart && rev.id < timeStart + timeWindowLength) {
					if (rev.size > relativeMaxSize) relativeMaxSize = rev.size;
				}
			}

			var xDomain = (timeWindowLength - 1) * revWidth + revWidth * 10;
			xScale = ($p.width - textAreaWidth) / xDomain;
			yScale = mainChartHeight / relativeMaxSize;
		}
		
		$p.updateScales = updateScales;

		function renderMainChart() {
			$p.pushMatrix();
			$p.translate(0, (1 - yScale) * mainChartHeight);
			$p.scale(xScale, yScale);

			var prevX = 0;
			var prevW = 0;
			$p.noStroke();
			for (var $it2 = new $p.ObjectIterator(revisions), rev = void(0); $it2.hasNext() && ((rev = $it2.next()) || true);) {
				if (rev.id > timeStart && rev.id < timeStart + timeWindowLength) {
					rev.update(prevX, prevW);
					rev.render();
					prevX = rev.x;
					prevW = rev.w;
				}
			}
			$p.popMatrix();
		}

		$p.renderMainChart = renderMainChart;

		function renderBottomChart() {
			$p.stroke(255);
			$p.noFill();
			$p.beginShape();
			for (var $it3 = new $p.ObjectIterator(revisions), rev = void(0); $it3.hasNext() && ((rev = $it3.next()) || true);) {
				var bx = $p.map(rev.id, 0, revisionCount, 0, $p.width - textAreaWidth);
				var by = $p.map(rev.size, 0, absoluteMaxSize, $p.height, $p.height - bottomChartHeight);
				$p.curveVertex(bx, by);
			}
			$p.endShape();
			$p.fill(255, 100);
			$p.noStroke();
			$p.rect(rectX, mainChartHeight, rectW, bottomChartHeight);
		}
	
		$p.renderBottomChart = renderBottomChart;

		function renderSelectedRevision() {
			var yText = 0;
			var selectedRevisionScreenHeight = $p.map(selectedRevision.size, 0, relativeMaxSize, 0, mainChartHeight);
			if ($p.mouseY < mainChartHeight) yText -= $p.map($p.mouseY, mainChartHeight - selectedRevisionScreenHeight, mainChartHeight, a * selectedRevision.nLines + d, 0);
			for (var $it4 = new $p.ObjectIterator(selectedRevision.contributions), contrib = void(0); $it4.hasNext() && ((contrib = $it4.next()) || true);) {
				$p.fill(contrib.contributor.col);
				var snippet = selectedRevision.txt.slice(contrib.start, contrib.start + contrib.leng);
				$p.text(snippet, $p.width - textAreaWidth, yText, textAreaWidth, yText + a * contrib.nLines + d);
				yText += a * contrib.nLines + d;
			}
		}

		$p.renderSelectedRevision = renderSelectedRevision;       
	}
}