		
//  -----------------------------------
//  PATH OBJECT
//  -----------------------------------

	function Path(oa){
		this.objtype = "path";

		//debug("NEW PATH: oa = \n" + JSON.stringify(oa));

		// declare attributes
		this.pathpoints = false;
		if(oa.pathpoints.length){
			this.pathpoints = [];
			//debug("NEW PATH : Hydrating Path Points, length " + oa.pathpoints.length);
			for (var i = 0; i < oa.pathpoints.length; i++) {
				this.pathpoints[i] = new PathPoint(oa.pathpoints[i]);
			}
		}
		this.clockwise = isval(oa.clockwise)? oa.clockwise : findClockwise(this.pathpoints);
		// internal
		this.topy = isval(oa.topy)? oa.topy : -1;	
		this.bottomy = isval(oa.bottomy)? oa.bottomy : -1;
		this.leftx = isval(oa.leftx)? oa.leftx : -1;
		this.rightx = isval(oa.rightx)? oa.rightx : -1;
		this.needsnewcalcmaxes = isval(oa.needsnewcalcmaxes)? oa.needsnewcalcmaxes : true;
		
		// Setup the object
		this.selectPathPoint(-1);
		//if(this.pathpoints) this.calcMaxes();
		
		//debug("Path() - created new path: " + this.pathpoints);
	}


	

//  -----------------------------------
//  PATH METHODS
//  -----------------------------------


	// Selected Point - returns the selected point object
	Path.prototype.sp = function(wantindex, calledby){
		//debug("SP - Called By : " + calledby);
		
		if(!this.pathpoints) {
			//debug("SP - returning false, this.pathpoints = " + JSON.stringify(this.pathpoints));
			return false;
		}
		
		for(var p=0; p<this.pathpoints.length; p++){
			var thisp = this.pathpoints[p];
			if(thisp.selected){
				if(wantindex){
					return p;
				} else {
					return thisp;
				}
			}
		}
		
		return false;
	}
	
	Path.prototype.drawPath = function(lctx) {		
		var tempvp = clone(_UI.viewport);
		
		// Check to see if this is a Ghost Canvas draw
		if(lctx == _UI.calcmaxesghostctx) { 
			//debug("DRAWSHAPE - CMGC DETECTED");
			_UI.viewport.zoom = 1;			
			_UI.viewport.originx = _UI.defaultviewport.originx;
			_UI.viewport.originy = _UI.defaultviewport.originy;
		}
		
		this.outlinePathOnCanvas(lctx); 

		_UI.viewport = tempvp;
	}

	Path.prototype.outlinePathOnCanvas = function(lctx) {
		if(this.pathpoints.length < 2) return;
		var pp, np, pph2x, pph2y, nxh1x, nxh1y, nxppx, nxppy;

		lctx.moveTo(sx_cx(this.pathpoints[0].P.x), sy_cy(this.pathpoints[0].P.y));

		for(var cp = 0; cp < this.pathpoints.length; cp++){
			pp = this.pathpoints[cp];
			np = this.pathpoints[(cp+1) % this.pathpoints.length];
			
			if(pp.type == "symmetric") { pp.makeSymmetric("H1"); }
			else if (pp.type == "flat") { pp.makeFlat("H1"); }
			
			pph2x = (pp.useh2? sx_cx(pp.H2.x) : sx_cx(pp.P.x));
			pph2y = (pp.useh2? sy_cy(pp.H2.y) : sy_cy(pp.P.y));
			nxh1x = (np.useh1? sx_cx(np.H1.x) : sx_cx(np.P.x));
			nxh1y = (np.useh1? sy_cy(np.H1.y) : sy_cy(np.P.y));
			nxppx = sx_cx(np.P.x);
			nxppy = sy_cy(np.P.y);
			
			lctx.bezierCurveTo(pph2x, pph2y, nxh1x, nxh1y, nxppx, nxppy); 
		}

	}
	
	Path.prototype.drawPathToArea = function(lctx, size, offsetX, offsetY){
		var tempv = clone(_UI.viewport);

		_UI.viewport.originx = offsetX;
		_UI.viewport.originy = offsetY;
		_UI.viewport.zoom = size;	
		
		this.drawPath(lctx);
		
		_UI.viewport = tempv;
	}
	
	Path.prototype.genPathPostScript = function(lastx, lasty){
		if(!this.pathpoints) return {"re":"", "lastx":lastx, "lasty":lasty};

		var p1, p2, p1h2x, p1h2y, p2h1x, p2h1y, p2ppx, p2ppy;
		var trr = "";

		var re = "" + (this.pathpoints[0].P.x - lastx) + " " + (this.pathpoints[0].P.y - lasty) + " rmoveto ";
		
		//debug("GENPATHPOSTSCRIPT:\n\t " + re);

		for(var cp = 0; cp < this.pathpoints.length; cp++){
			p1 = this.pathpoints[cp];
			p2 = this.pathpoints[(cp+1) % this.pathpoints.length];

			p1h2x = p1.useh2? (p1.H2.x - p1.P.x) : 0;
			p1h2y = p1.useh2? (p1.H2.y - p1.P.y) : 0;
			p2h1x = p2.useh1? (p2.H1.x - (p1.useh2? p1.H2.x : p1.P.x)) : (p2.P.x - (p1.useh2? p1.H2.x : p1.P.x));
			p2h1y = p2.useh1? (p2.H1.y - (p1.useh2? p1.H2.y : p1.P.y)) : (p2.P.y - (p1.useh2? p1.H2.y : p1.P.y));
			p2ppx = (p2.P.x - (p2.useh1? p2.H1.x : p2.P.x));
			p2ppy = (p2.P.y - (p2.useh1? p2.H1.y : p2.P.y));

			trr = "\t\t\t\t" + p1h2x + " " + p1h2y + " " + p2h1x + " " + p2h1y + " " + p2ppx + " " + p2ppy + " rrcurveto \n";

			//debug("\t " + trr);

			re += trr;
		}

		return {
			"re" : re,
			"lastx" : p2.P.x,
			"lasty" : p2.P.y
			};
	}
	
	Path.prototype.isOverControlPoint = function(x, y){
		var a = this.pathpoints;
		//var hp = _GP.projectsettings.pointsize/2/_UI.viewport.zoom;
		var hp = _GP.projectsettings.pointsize/_UI.viewport.zoom;
		
		for(var k=a.length-1; k>=0; k--){
			if( ((a[k].P.x+hp) > x) && ((a[k].P.x-hp) < x) && ((a[k].P.y+hp) > y) && ((a[k].P.y-hp) < y) ){
				this.selectPathPoint(k);
				//debug("ISOVERCONTROLPOINT() - Returning P1, selectedpoint: " + k);
				return 'P';
			}
			
			if( ((a[k].H1.x+hp) > x) && ((a[k].H1.x-hp) < x) && ((a[k].H1.y+hp) > y) && ((a[k].H1.y-hp) < y) ){
				this.selectPathPoint(k);
				//debug("ISOVERCONTROLPOINT() - Returning H1, selectedpoint: " + k);
				return 'H1';
			}
			
			if( ((a[k].H2.x+hp) > x) && ((a[k].H2.x-hp) < x) && ((a[k].H2.y+hp) > y) && ((a[k].H2.y-hp) < y) ){
				this.selectPathPoint(k);
				//debug("ISOVERCONTROLPOINT() - Returning H2, selectedpoint: " + k);
				return 'H2';
			}
		}
		
		this.selectPathPoint(0);
		//debug("ISOVERCONTROLPOINT() - Returning FALSE");
		return false;
	}
	
	Path.prototype.updatePathSize = function(dw, dh){
		//debug("UPDATEPATHSIZE - Change Size: dw/dh "+dw+" , "+dh);
		var ps = _GP.projectsettings;
		
		var s = ss("updatePathPosition");
		s.wlock? dw = 0 : false;
		s.hlock? dh = 0 : false;
		
		if(s.wlock && s.hlock) return;
		
		_UI.calcmaxesghostctx.clearRect(0,0,_UI.calcmaxesghostcanvas.width,_UI.calcmaxesghostcanvas.height);
		_UI.calcmaxesghostctx.lineWidth = 1;
		_UI.calcmaxesghostctx.fillStyle = "lime";
		_UI.calcmaxesghostctx.strokeStyle = "lime";
		
		//Setup temp zoom/pan for cmgc
		var tempvp = clone(viewport);
		_UI.viewport.zoom = 1;			
		_UI.viewport.originx = ps.upm;
		_UI.viewport.originy = ps.upm*2;
			
		this.drawPath(_UI.calcmaxesghostctx);
		//debug("UPDATEPATHSIZE - Just finished drawing to CMGC");
		var r = getMaxesFromGhostCanvas(this.getMaxesFromPathPoints());
		//drawCMGCorigins("lime");
				
		var rx = r.rightx;
		var lx = r.leftx;
		var ty = r.topy;
		var by = r.bottomy;
		
		var oldw = rx - lx;
		var oldh = ty - by;
		var neww = oldw + dw;
		var newh = oldh + dh;
		var ratiodh = (newh/oldh);
		var ratiodw = (neww/oldw);

		//debug("---------------- Saved Shape Maxes: l/r/t/b: " + s.leftx + " , " + s.rightx + " , " + s.topy + " , " + s.bottomy);
		//debug("---------------- ---GC Shape Maxes: l/r/t/b: " + r.leftx + " , " + r.rightx + " , " + r.topy + " , " + r.bottomy);
		
		//debug("---------------- Passed Deltas-: w/h: " + dw + " , " + dh);
		//debug("---------------- New Shape Size: w/h: " + neww + " , " + newh);
		//debug("---------------- HEIGHT RATI new/old: " + (newh/oldh));

		for(var e=0; e<this.pathpoints.length; e++){
			var pp = this.pathpoints[e];
			pp.P.x =   round( ((pp.P.x  - lx) * ratiodw) + lx  );
			pp.H1.x =  round( ((pp.H1.x - lx) * ratiodw) + lx  );
			pp.H2.x =  round( ((pp.H2.x - lx) * ratiodw) + lx  );
			pp.P.y =   round( ((pp.P.y  - by) * ratiodh) + by  );
			pp.H1.y =  round( ((pp.H1.y - by) * ratiodh) + by  );
			pp.H2.y =  round( ((pp.H2.y - by) * ratiodh) + by  );
		}
		
		//this.calcMaxes();
		this.topy += dh;
		//this.bottomy -= (dh/4);
		this.rightx += dw;
		//this.leftx += (dw/2);
		
		_UI.viewport = tempvp;
		//debug("UPDATEPATHSIZE - done");
	}
	
	Path.prototype.updatePathPosition = function(dx, dy, force){
		isval(force)? true : force = false;
		//debug("UPDATEPATHPOSITION - dx,dy,force "+dx+","+dy+","+force+" - pathpoints length: " + this.pathpoints.length);

		for(var d=0; d<this.pathpoints.length; d++){
			var pp = this.pathpoints[d];
			//debug("-------------------- pathPoint #" + d);
			pp.updatePointPosition("P",dx,dy,force);
		}
		
		this.topy += dy;
		this.bottomy += dy;
		this.leftx += dx;
		this.rightx += dx;
	}
	
	function findClockwise(parr){
		var j,k,z;
		var count = 0;

		if (parr.length < 3) return 0;

		for (var i=0; i<parr.length; i++) {
			j = (i + 1) % parr.length;
			k = (i + 2) % parr.length;
			z  = (parr[j].P.x - parr[i].P.x) * (parr[k].P.y - parr[j].P.y);
			z -= (parr[j].P.y - parr[i].P.y) * (parr[k].P.x - parr[j].P.x);
			
			if (z < 0) count--;
			else if (z > 0) count++;
		}

		// negative = clockwise
		// positive = counterclockwise
		
		//debug("FINDCLOCKWISE returning " + count);
		return count;
	}

	Path.prototype.reversePath = function(){
		var HT = {};
		if(this.pathpoints){
			for (var i = 0; i < this.pathpoints.length; i++) {
				HT = this.pathpoints[i].H1;
				this.pathpoints[i].H1 = this.pathpoints[i].H2;
				this.pathpoints[i].H2 = HT;
				if(this.pathpoints[i].useh1 !== this.pathpoints[i].useh2){
					this.pathpoints[i].useh1 = !this.pathpoints[i].useh1;
					this.pathpoints[i].useh2 = !this.pathpoints[i].useh2;
				}
			}
			this.pathpoints.reverse();
			this.clockwise *= -1;
		}
	}

	Path.prototype.flipNS = function(){
		var ly = this.topy;
		var lx = this.leftx;
		_UI.calcmaxesghostctx.clearRect(0,0,_UI.calcmaxesghostcanvas.width,_UI.calcmaxesghostcanvas.height);
		this.drawPath(_UI.calcmaxesghostctx);
		var r = getMaxesFromGhostCanvas(this.getMaxesFromPathPoints());

		var mid = ((r.topy - r.bottomy)/2)+r.bottomy;
		//debug("FLIPNS - calculating mid: (b-t)/2 + t = mid: " + r.bottomy +","+ r.topy + ","+ mid);
		
		for(var e=0; e<this.pathpoints.length; e++){
			var pp = this.pathpoints[e];
			pp.P.y += ((mid-pp.P.y)*2);
			pp.H1.y += ((mid-pp.H1.y)*2);
			pp.H2.y += ((mid-pp.H2.y)*2);
		}
		
		this.needsnewcalcmaxes = true;
		this.setTopY(ly);
		this.setLeftX(lx);

		this.reversePath();
	}
	
	Path.prototype.flipEW = function(){
		var ly = this.topy;
		var lx = this.leftx;
		_UI.calcmaxesghostctx.lineWidth = ss().strokeweight;
		_UI.calcmaxesghostctx.clearRect(0,0,_UI.calcmaxesghostcanvas.width,_UI.calcmaxesghostcanvas.height);
		this.drawPath(_UI.calcmaxesghostctx);
		var r = getMaxesFromGhostCanvas(this.getMaxesFromPathPoints());

		var mid = ((r.rightx - r.leftx)/2)+r.leftx;
		//debug("flipEW - calculating mid: (b-t)/2 + t = mid: " + r.rightx +","+ r.leftx +","+ mid);
		
		for(var e=0; e<this.pathpoints.length; e++){
			var pp = this.pathpoints[e];
			pp.P.x += ((mid-pp.P.x)*2);
			pp.H1.x += ((mid-pp.H1.x)*2);
			pp.H2.x += ((mid-pp.H2.x)*2);
		}
		
		this.needsnewcalcmaxes = true;
		this.setTopY(ly);
		this.setLeftX(lx);

		this.reversePath();
	}
	
	Path.prototype.setTopY = function(newvalue){
		var delta = ((newvalue*1) - ss("setTopY").path.topy);
		this.updatePathPosition(0,delta);
	}
	
	Path.prototype.setLeftX = function(newvalue){
		this.updatePathPosition(((newvalue*1) - ss("SetLeftX").path.leftx),0);
	}

	Path.prototype.addPathPoint = function(newpp, addtostart){
		//debug("ADDPATHPOINT - new point? " + newpp);
		
		if(!newpp) { 
			// No pathpoint passed to function - make a new one
			newpp = new PathPoint({}); 
			
			if(addtostart){
				//Adds new pathpoint to start of path
				if(this.pathpoints.length > 0){
					var firstpp = this.pathpoints[0];
					
					newpp.P.x = firstpp.P.x-200;
					newpp.P.y = firstpp.P.y-200;
					newpp.H1.x = newpp.P.x;
					newpp.H1.y = newpp.P.y-100;
					newpp.H2.x = newpp.P.x+100;
					newpp.H2.y = newpp.P.y;
				}	
				
				this.pathpoints.unshift(newpp);
				this.selectPathPoint(0);
			} else {
				// Adds new pathpoint to end of path
				if(this.pathpoints.length > 0){
					var lastpp = this.pathpoints[this.pathpoints.length-1];
					
					newpp.P.x = lastpp.P.x+200;
					newpp.P.y = lastpp.P.y+200;
					newpp.H1.x = newpp.P.x;
					newpp.H1.y = newpp.P.y-100;
					newpp.H2.x = newpp.P.x+100;
					newpp.H2.y = newpp.P.y;
				}
				
				this.pathpoints.push(newpp);
				this.selectPathPoint(this.pathpoints.length-1);
			}
		} else {
			// Function was passed a new path point
			this.pathpoints.push(newpp);
			this.selectPathPoint(this.pathpoints.length-1);
		}		
	}
	
	Path.prototype.insertPathPoint = function() {

		var p1i = this.sp(true, "insert path point");
		var p1 = (p1i === false ? this.pathpoints[0] : this.pathpoints[p1i]);

		if(this.pathpoints.length > 1){
			var p2 = this.pathpoints[(p1i+1)%this.pathpoints.length];

	  		var newPx = (p1.P.x*.125) + (p1.H2.x*.375) + (p2.H1.x*.375) + (p2.P.x*.125);
	  		var newPy = (p1.P.y*.125) + (p1.H2.y*.375) + (p2.H1.y*.375) + (p2.P.y*.125);

	  		var newpp = new PathPoint({"P":new Coord({"x":newPx, "y":newPy}), "type":"flat"});
	  		// Handles (tangents)

	  		var newH2x = ((p2.H1.x - p2.P.x) / 2) + p2.P.x;
	  		var newH2y = ((p2.P.y - p2.H1.y) / 2) + p2.H1.y;

		    //debug("INSERTPATHPOINT - before makepointedto " + JSON.stringify(newpp));

	  		newpp.makePointedTo(newH2x, newH2y, 100);
	  		var tempH2 = newpp.H2;
	  		newpp.H2 = newpp.H1;
	  		newpp.H1 = tempH2;
	  		newpp.makeSymmetric("H2");

		    //debug("INSERTPATHPOINT - afters makepointedto " + JSON.stringify(newpp));


		    this.pathpoints.splice((p1i+1)%this.pathpoints.length, 0, newpp);
		    this.selectPathPoint((p1i+1)%this.pathpoints.length);

	  	}
	}

	Path.prototype.deletePathPoint = function(){
		var pp = this.pathpoints;
		
		if(pp.length > 1){
			for(var j=0; j<pp.length; j++){
				if(pp[j].selected){
					pp.splice(j, 1);
					if(j>0) {
						pp[j-1].selected = true;
					} else {
						pp[0].selected = true;
					}
				}
			}
		} else {
			_UI.selectedtool = "pathedit";
			deleteShape();
		}
	}
	
	Path.prototype.selectPathPoint = function(index){
	// FOR NOW, ONLY ONE POINT SELECTED
		for(var j=0; j<this.pathpoints.length; j++){
			this.pathpoints[j].selected = false;
		}
		
		if(index == -1){
			return;
		} else if(this.pathpoints[index]){
			this.pathpoints[index].selected = true;
			//debug("SELECTPATHPOINT - selecting point " + index);
		} 
		/*
		else if (this.pathpoints[0]){
			this.pathpoints[0].selected = true;
			//debug("SELECTPATHPOINT - defaulting to 0 index point selection");
		}
		*/
	}

//	----------------------------------
//	Calc Maxes Stuff
//	----------------------------------

	Path.prototype.calcMaxes = function(){
		if(this.needsnewcalcmaxes){
			debug("\n");
			debug("!!!!!!!!!!!!!!!!!!!CALCMAXES!!!!!!!!!!!!!!!!!!!!!!!!!!!");
			debug("!!!----------------before ty/by/lx/rx: " + this.topy + "/" + this.bottomy + "/" + this.leftx + "/" + this.rightx);
			//debug("!!!CALCMAXES - _UI.cmgcs.size/ox/oy: " + _UI.chareditcanvassize + " / " + _UI.viewport.originx + " / " + _UI.viewport.originy);
			
			this.topy = (_UI.chareditcanvassize*-1);
			this.bottomy = _UI.chareditcanvassize;
			this.leftx = _UI.chareditcanvassize;
			this.rightx = (_UI.chareditcanvassize*-1);

			_UI.calcmaxesghostctx.clearRect(0,0,_UI.chareditcanvassize,_UI.chareditcanvassize);
			this.drawPath(_UI.calcmaxesghostctx);
			
			console.time("CalcMaxes_origional");
			var mp = getMaxesFromGhostCanvas(this.getMaxesFromPathPoints());
			console.timeEnd("CalcMaxes_origional");
			
			console.time("CalcMaxes_NEW");
			var mp2 = this.getMaxesFromMath();
			console.timeEnd("CalcMaxes_NEW");
			
			this.topy = mp.topy;
			this.bottomy = mp.bottomy;
			this.leftx = mp.leftx;
			this.rightx = mp.rightx;
			
			debug("!!!----------------afters ty/by/lx/rx:\t" + this.topy + "\t" + this.bottomy + "\t" + this.leftx + "\t" + this.rightx);	
			debug("!!!----------------afters max/x/y min/x/y:\t" + mp2.maxx + "\t" + mp2.maxy + "\t" + mp2.minx + "\t" + mp2.miny);	
			debug("\n");
		}
		
		this.needsnewcalcmaxes = false;
	}

	Path.prototype.getMaxesFromMath = function(){
		var finalbounds = {
			"maxx" : -999999,
			"minx" : 999999,
			"maxy" : -999999,
			"miny" : 999999
		}

		var tp, np, tbounds;

		for(var s=0; s<this.pathpoints.length; s++){
			tp = this.pathpoints[s];
			np = this.pathpoints[(s+1)%this.pathpoints.length];
			tbounds = getBounds(tp.P.x, tp.P.y, tp.H2.x, tp.H2.y, np.H1.x, np.H1.y, np.P.x, np.P.y);

			finalbounds.maxx = Math.max(finalbounds.maxx, tbounds.maxx);
			finalbounds.maxy = Math.max(finalbounds.maxy, tbounds.maxy);
			finalbounds.minx = Math.min(finalbounds.minx, tbounds.minx);
			finalbounds.miny = Math.min(finalbounds.miny, tbounds.miny);
		}

		return finalbounds;
	}

	function getMaxesFromGhostCanvas(sr){
		//debug("GETMAXESFROMGHOSTCANVAS - sr passed: " + JSON.stringify(sr));

		sr.topy = Math.ceil(_UI.chareditcanvassize - (sr.topy+(_UI.chareditcanvassize-_UI.viewport.originy)));
		sr.bottomy = Math.floor(_UI.chareditcanvassize - (sr.bottomy+(_UI.chareditcanvassize-_UI.viewport.originy)));
		sr.leftx = Math.ceil(_UI.viewport.originx + sr.leftx);
		sr.rightx = Math.floor(_UI.viewport.originx + sr.rightx);
		
		//debug("GETMAXESFROMGHOSTCANVAS - Converted ty/by/lx/rx: " + sr.topy + "/" + sr.bottomy + "/" + sr.leftx + "/" + sr.rightx);	
		
		var initialrow = sr.topy;
		
		var leftmost = _UI.chareditcanvassize;
		var rightmost = 0;
		var topmost = _UI.chareditcanvassize;
		var bottommost = 0;
		
		var imageData = _UI.calcmaxesghostctx.getImageData(0,0,_UI.calcmaxesghostcanvas.width,_UI.calcmaxesghostcanvas.height);
		var colreturn = _UI.chareditcanvassize;
		
		//debug("GETMAXESNEW - starting BottomY, initialrow to _UI.chareditcanvassize: " + initialrow + " to " + _UI.chareditcanvassize);

		//Get BottomY
		//debug("---<b>GET BOTTOM Y</b>---");
		for(var row=sr.bottomy; row<_UI.chareditcanvassize; row++){
			colreturn = checkRowLTR(row, imageData);
			if(colreturn == "clear"){
				bottommost = (row);
				break;
			}
		}
		//debug("GETMAXESNEW - end of Bottom Y: " + bottommost);
		
		//Get TopY
		//debug("---<b>GET TOP Y</b>---");
		for(var row=sr.topy; row>0; row--){
			colreturn = checkRowLTR(row, imageData);
			if(colreturn == "clear"){
				topmost = (row+1);
				break;
			}
		}
		//debug("GETMAXESNEW - end of Top Y: " + topmost);

		//Get RightX
		//debug("---<b>GET RIGHT X</b>---");
		for(var col=sr.rightx; col<_UI.chareditcanvassize; col++){
			rowreturn = checkColBTT(col, imageData);
			if(rowreturn == "clear"){
				rightmost = (col);
				break;
			}
		}
		//debug("GETMAXESNEW - end of Right X: " + rightmost);
		
		//Get LeftX
		//debug("---<b>GET Left X</b>---");
		for(var col=sr.leftx; col>0; col--){
			rowreturn = checkColBTT(col, imageData);
			if(rowreturn == "clear"){
				leftmost = (col+1);
				break;
			}
		}
		//debug("GETMAXESNEW - end of Left X: " + rightmost);
		
		var nx = {};
		nx.leftx = (leftmost - _UI.viewport.originx);
		nx.rightx = (rightmost - _UI.viewport.originx);
		nx.topy = (_UI.viewport.originy - topmost);
		nx.bottomy = (_UI.viewport.originy - bottommost);
		
		return nx;
		
	}
	
	function checkRowLTR(row, imgdata){
		for(var col=0; col<_UI.chareditcanvassize; col++){
			thispx = (row*imgdata.width*4) + (col*4) + 3;
			if(imgdata.data[thispx] > 0){
				return col;
			}
		}
		return "clear";
	}
	
	function checkColBTT(col, imgdata){
		for(var row=_UI.chareditcanvassize; row>0; row--){
			thispx = (row*imgdata.width*4) + (col*4) + 3;
			if(imgdata.data[thispx] > 0){
				return row;
			}
		}
		return "clear";
	}

	Path.prototype.getMaxesFromPathPoints = function(){
		var ps = _GP.projectsettings;
		var r = {
			"topy" : (ps.upm*-1),
			"rightx" : (ps.upm*-1),
			"bottomy" : ps.upm,
			"leftx" : ps.upm
		};
		
		for(var j=0; j<this.pathpoints.length; j++){
			var pp = this.pathpoints[j];
			r.topy = Math.max(r.topy, pp.P.y);
			r.bottomy = Math.min(r.bottomy, pp.P.y);
			r.rightx = Math.max(r.rightx, pp.P.x);
			r.leftx = Math.min(r.leftx, pp.P.x);
		}
		
		//debug("GETMAXESFROMPATHPOINTS - returned top/bottom/left/right: " + r.topy + " / " + r.bottomy + " / " + r.leftx + " / " + r.rightx);
		return r;
	}
	
	





	function getBounds(x1, y1, cx1, cy1, cx2, cy2, x2, y2){
		var bounds = {
			"minx" : Math.min(x1,x2),
			"miny" : Math.min(y1,y2),
			"maxx" : Math.max(x1,x2),
			"maxy" : Math.max(y1,y2)
		};

		var dcx0 = cx1 - x1;
		var dcy0 = cy1 - y1;
		var dcx1 = cx2 - cx1;
		var dcy1 = cy2 - cy1;
		var dcx2 = x2 - cx2;
		var dcy2 = y2 - cy2;

		if(cx1<bounds["minx"] || cx1>bounds["maxx"] || cx2<bounds["minx"] || cx2>bounds["maxx"]) {   
			// X bounds
			if(dcx0+dcx2 != 2*dcx1) { dcx1+=0.01; }
			var numerator = 2*(dcx0 - dcx1);
			var denominator = 2*(dcx0 - 2*dcx1 + dcx2);
			var quadroot = (2*dcx1-2*dcx0)*(2*dcx1-2*dcx0) - 2*dcx0*denominator;
			var root = Math.sqrt(quadroot);
			var t1 =  (numerator + root) / denominator;
			var t2 =  (numerator - root) / denominator;
			if(0<t1 && t1<1) { checkXbounds(bounds, getBezierValue(t1, x1, cx1, cx2, x2)); }
			if(0<t2 && t2<1) { checkXbounds(bounds, getBezierValue(t2, x1, cx1, cx2, x2)); }
		}

		// Y bounds
		if(cy1<bounds["miny"] || cy1>bounds["maxy"] || cy2<bounds["miny"] || cy2>bounds["maxy"]) {
			if(dcy0+dcy2 != 2*dcy1) { dcy1+=0.01; }
			var numerator = 2*(dcy0 - dcy1);
			var denominator = 2*(dcy0 - 2*dcy1 + dcy2);
			var quadroot = (2*dcy1-2*dcy0)*(2*dcy1-2*dcy0) - 2*dcy0*denominator;
			var root = Math.sqrt(quadroot);
			var t1 =  (numerator + root) / denominator;
			var t2 =  (numerator - root) / denominator;
			if(0<t1 && t1<1) { checkYbounds(bounds, getBezierValue(t1, y1, cy1, cy2, y2)); }
			if(0<t2 && t2<1) { checkYbounds(bounds, getBezierValue(t2, y1, cy1, cy2, y2)); }
		}

		return bounds;
	}

	function checkXbounds(bounds, value) {
		if(bounds["minx"] > value) { bounds["minx"] = value; }
		else if(bounds["maxx"] < value) { bounds["maxx"] = value; }
	}

	function checkYbounds(bounds, value) {
		if(bounds["miny"] > value) { bounds["miny"] = value; }
		else if(bounds["maxy"] < value) { bounds["maxy"] = value; }
	}

	function getBezierValue(t, p0, p1, p2, p3) {
		var mt = (1-t);
    	return (mt*mt*mt*p0) + (3*mt*mt*t*p1) + (3*mt*t*t*p2) + (t*t*t*p3); 
	}